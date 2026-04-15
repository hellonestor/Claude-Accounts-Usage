import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import readline from 'node:readline/promises'
import { loadStore, saveStore, emptyAccount, STORE_PATH } from './store.mjs'
import {
  ensureFreshToken, fetchUsage, fetchProfile, runLoginFlow,
} from './oauth.mjs'
import { renderTable } from './render.mjs'

async function hydrateProfile(acct) {
  try {
    const p = await fetchProfile(acct.accessToken)
    if (p?.account) {
      acct.email       = p.account.email
      acct.accountUuid = p.account.uuid
      acct.hasMax      = p.account.has_claude_max
      acct.hasPro      = p.account.has_claude_pro
    }
    if (p?.organization) acct.tier = p.organization.rate_limit_tier
  } catch {}
}

export async function login([label]) {
  if (!label) throw new Error('usage: login <label>')
  const store = await loadStore()
  const acct = store.accounts[label] || emptyAccount(label)

  console.error('Opening browser for OAuth login…')
  const tokens = await runLoginFlow({
    onOpen: url => console.error(`If browser did not open, visit:\n  ${url}\n`),
  })
  Object.assign(acct, tokens)
  await hydrateProfile(acct)

  store.accounts[label] = acct
  await saveStore(store)
  console.error(`\n✓ saved  label=${label}  email=${acct.email ?? 'unknown'}  tier=${acct.tier ?? '?'}`)
}

export async function importLocal([label]) {
  if (!label) throw new Error('usage: import <label>')
  const raw = await fs.readFile(path.join(os.homedir(), '.claude/.credentials.json'), 'utf8')
  const c = JSON.parse(raw).claudeAiOauth
  if (!c?.refreshToken) throw new Error('no claudeAiOauth.refreshToken found')
  const store = await loadStore()
  const acct = emptyAccount(label)
  acct.accessToken  = c.accessToken  ?? null
  acct.refreshToken = c.refreshToken
  acct.expiresAt    = c.expiresAt    ?? 0
  acct.scopes       = c.scopes       ?? []
  await ensureFreshToken(acct)
  await hydrateProfile(acct)
  store.accounts[label] = acct
  await saveStore(store)
  console.error(`✓ imported  label=${label}  email=${acct.email ?? 'unknown'}`)
}

export async function importToken([label]) {
  if (!label) throw new Error('usage: import-token <label>')
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr })
  const refreshToken = (await rl.question('refreshToken: ')).trim()
  rl.close()
  if (!refreshToken) throw new Error('empty refreshToken')
  const store = await loadStore()
  const acct = emptyAccount(label)
  acct.refreshToken = refreshToken
  await ensureFreshToken(acct)
  await hydrateProfile(acct)
  store.accounts[label] = acct
  await saveStore(store)
  console.error(`✓ imported-token  label=${label}  email=${acct.email ?? 'unknown'}`)
}

export async function remove([label]) {
  const store = await loadStore()
  if (!store.accounts[label]) throw new Error(`not found: ${label}`)
  delete store.accounts[label]
  await saveStore(store)
  console.error(`✓ removed ${label}`)
}

async function collectOne(store, label, acct) {
  try {
    const { refreshed } = await ensureFreshToken(acct)
    if (refreshed) store.__dirty = true
    const u = await fetchUsage(acct.accessToken)
    acct.lastCheckedAt = new Date().toISOString()
    store.__dirty = true
    return {
      label, email: acct.email, tier: acct.tier,
      five_hour:         u.five_hour?.utilization         ?? null,
      five_hour_resets:  u.five_hour?.resets_at           ?? null,
      seven_day:         u.seven_day?.utilization         ?? null,
      seven_day_resets:  u.seven_day?.resets_at           ?? null,
      seven_day_opus:    u.seven_day_opus?.utilization    ?? null,
      seven_day_sonnet:  u.seven_day_sonnet?.utilization  ?? null,
      extra_used:        u.extra_usage?.used_credits      ?? null,
      extra_limit:       u.extra_usage?.monthly_limit     ?? null,
      extra_pct:         u.extra_usage?.utilization       ?? null,
    }
  } catch (e) {
    return { label, email: acct.email, error: String(e.message || e) }
  }
}

export async function list(args) {
  const json = args.includes('--json')
  const filter = args.filter(a => !a.startsWith('--'))[0]
  const store = await loadStore()
  const entries = Object.entries(store.accounts)
    .filter(([l]) => !filter || l === filter)
  if (entries.length === 0) { console.error('no accounts. try `login <label>` or `import <label>`'); return }

  const rows = []
  for (const [label, acct] of entries) rows.push(await collectOne(store, label, acct))
  if (store.__dirty) { delete store.__dirty; await saveStore(store) }

  if (json) console.log(JSON.stringify(rows, null, 2))
  else      console.log(renderTable(rows))
}

export async function watch(args) {
  const i = args.indexOf('--interval')
  const interval = (i >= 0 ? +args[i + 1] : 300) * 1000
  process.stderr.write('\x1b[?25l')
  const tick = async () => {
    process.stdout.write('\x1b[2J\x1b[H')
    console.log(`[${new Date().toISOString()}]  refresh every ${interval/1000}s  — ctrl-c to quit\n`)
    await list([])
  }
  await tick()
  const t = setInterval(tick, interval)
  process.on('SIGINT', () => { clearInterval(t); process.stderr.write('\x1b[?25h\n'); process.exit(0) })
}

export async function where() { console.log(STORE_PATH) }

export async function serve(args) {
  const { startServer } = await import('./server.mjs')
  const i = args.indexOf('--port')
  const port = i >= 0 ? Number(args[i + 1]) : 7789
  const hIdx = args.indexOf('--host')
  const host = hIdx >= 0 ? args[hIdx + 1] : '127.0.0.1'
  await startServer({ port, host })
}
