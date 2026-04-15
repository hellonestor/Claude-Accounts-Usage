import http from 'node:http'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomBytes } from 'node:crypto'
import {
  loadStore, saveStore, emptyAccount, STORE_PATH,
} from './store.mjs'
import {
  ensureFreshToken, fetchUsage, fetchProfile, runLoginFlow,
} from './oauth.mjs'

const __filename = fileURLToPath(import.meta.url)
const WEB_DIR = path.join(path.dirname(__filename), 'web')
const DATA_DIR = path.join(path.dirname(__filename), '..', 'data')

const pendingLogins = new Map()

const NO_FETCH = () => process.env.CLAUDE_ACCOUNTS_NO_FETCH === '1'

function shapeUsage(acct, u) {
  return {
    label: acct.label,
    email: acct.email,
    tier: acct.tier,
    hasMax: acct.hasMax,
    hasPro: acct.hasPro,
    note: acct.note ?? '',
    tags: acct.tags ?? [],
    googleEmail: acct.googleEmail ?? '',
    googlePassword: acct.googlePassword ?? '',
    twofaUrl: acct.twofaUrl ?? '',
    addedAt: acct.addedAt,
    lastCheckedAt: acct.lastCheckedAt,
    five_hour: u?.five_hour?.utilization ?? null,
    five_hour_resets: u?.five_hour?.resets_at ?? null,
    seven_day: u?.seven_day?.utilization ?? null,
    seven_day_resets: u?.seven_day?.resets_at ?? null,
    seven_day_opus: u?.seven_day_opus?.utilization ?? null,
    seven_day_sonnet: u?.seven_day_sonnet?.utilization ?? null,
    seven_day_sonnet_resets: u?.seven_day_sonnet?.resets_at ?? null,
    extra_used: u?.extra_usage?.used_credits ?? null,
    extra_limit: u?.extra_usage?.monthly_limit ?? null,
    extra_pct: u?.extra_usage?.utilization ?? null,
    cached: !!acct.lastUsage && !u,
  }
}

async function collect(acct, store) {
  if (NO_FETCH()) {
    const shaped = shapeUsage(acct, acct.lastUsage)
    shaped.cached = true
    return shaped
  }
  try {
    const { refreshed } = await ensureFreshToken(acct)
    if (refreshed) store.__dirty = true
    const u = await fetchUsage(acct.accessToken)
    acct.lastCheckedAt = new Date().toISOString()
    acct.lastUsage = u
    store.__dirty = true
    return {
      label: acct.label,
      email: acct.email,
      tier: acct.tier,
      hasMax: acct.hasMax,
      hasPro: acct.hasPro,
      note: acct.note ?? '',
      tags: acct.tags ?? [],
      googleEmail: acct.googleEmail ?? '',
      googlePassword: acct.googlePassword ?? '',
      twofaUrl: acct.twofaUrl ?? '',
      addedAt: acct.addedAt,
      lastCheckedAt: acct.lastCheckedAt,
      five_hour: u.five_hour?.utilization ?? null,
      five_hour_resets: u.five_hour?.resets_at ?? null,
      seven_day: u.seven_day?.utilization ?? null,
      seven_day_resets: u.seven_day?.resets_at ?? null,
      seven_day_opus: u.seven_day_opus?.utilization ?? null,
      seven_day_sonnet: u.seven_day_sonnet?.utilization ?? null,
      seven_day_sonnet_resets: u.seven_day_sonnet?.resets_at ?? null,
      extra_used: u.extra_usage?.used_credits ?? null,
      extra_limit: u.extra_usage?.monthly_limit ?? null,
      extra_pct: u.extra_usage?.utilization ?? null,
    }
  } catch (e) {
    return {
      label: acct.label,
      email: acct.email,
      tier: acct.tier,
      note: acct.note ?? '',
      tags: acct.tags ?? [],
      googleEmail: acct.googleEmail ?? '',
      googlePassword: acct.googlePassword ?? '',
      twofaUrl: acct.twofaUrl ?? '',
      addedAt: acct.addedAt,
      lastCheckedAt: acct.lastCheckedAt,
      error: String(e.message || e),
    }
  }
}

function findEmailDupe(store, email, exceptLabel = null) {
  if (!email) return null
  const needle = String(email).trim().toLowerCase()
  for (const [k, a] of Object.entries(store.accounts)) {
    if (k === exceptLabel) continue
    if (a.email && String(a.email).trim().toLowerCase() === needle) return k
  }
  return null
}

function autoLabel(store, hint = '') {
  const base = (hint || 'acct').replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 40) || 'acct'
  if (!store.accounts[base]) return base
  let i = 2
  while (store.accounts[`${base}-${i}`]) i++
  return `${base}-${i}`
}

async function hydrateProfile(acct) {
  try {
    const p = await fetchProfile(acct.accessToken)
    if (p?.account) {
      acct.email = p.account.email
      acct.accountUuid = p.account.uuid
      acct.hasMax = p.account.has_claude_max
      acct.hasPro = p.account.has_claude_pro
    }
    if (p?.organization) acct.tier = p.organization.rate_limit_tier
  } catch {}
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve({})
      try { resolve(JSON.parse(raw)) }
      catch (e) { reject(new Error('invalid json body')) }
    })
    req.on('error', reject)
  })
}

function json(res, data, code = 200) {
  res.statusCode = code
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(data))
}

async function sendFile(res, file, type) {
  try {
    const buf = await fs.readFile(file)
    res.statusCode = 200
    res.setHeader('Content-Type', type)
    res.setHeader('Cache-Control', 'no-cache')
    res.end(buf)
  } catch {
    res.statusCode = 404
    res.end('not found')
  }
}

const routes = [
  ['GET',    /^\/$/,                             handleIndex],
  ['GET',    /^\/favicon\.svg$/,                 handleFavicon],
  ['GET',    /^\/api\/accounts$/,                handleList],
  ['POST',   /^\/api\/accounts\/import-local$/,  handleImportLocal],
  ['POST',   /^\/api\/accounts\/import-token$/,  handleImportToken],
  ['POST',   /^\/api\/accounts\/login\/start$/,  handleLoginStart],
  ['GET',    /^\/api\/accounts\/login\/([^/]+)$/, handleLoginStatus],
  ['PATCH',  /^\/api\/accounts\/([^/]+)$/,       handlePatch],
  ['DELETE', /^\/api\/accounts\/([^/]+)$/,       handleDelete],
  ['GET',    /^\/api\/health$/,                  (req, res) => json(res, { ok: true, store: STORE_PATH })],
]

async function handleIndex(req, res) {
  return sendFile(res, path.join(WEB_DIR, 'index.html'), 'text/html; charset=utf-8')
}

async function handleFavicon(req, res) {
  return sendFile(res, path.join(DATA_DIR, 'claude.svg'), 'image/svg+xml; charset=utf-8')
}

async function handleList(req, res) {
  const store = await loadStore()
  const rows = []
  for (const acct of Object.values(store.accounts)) rows.push(await collect(acct, store))
  if (store.__dirty) { delete store.__dirty; await saveStore(store) }
  json(res, { accounts: rows })
}

async function handleImportLocal(req, res, _, body) {
  const raw = await fs.readFile(path.join(process.env.HOME, '.claude/.credentials.json'), 'utf8')
  const c = JSON.parse(raw).claudeAiOauth
  if (!c?.refreshToken) return json(res, { error: 'no claudeAiOauth.refreshToken in credentials file' }, 400)

  const store = await loadStore()
  const tmpLabel = `__tmp_${randomBytes(4).toString('hex')}`
  const acct = emptyAccount(tmpLabel)
  acct.accessToken = c.accessToken ?? null
  acct.refreshToken = c.refreshToken
  acct.expiresAt = c.expiresAt ?? 0
  acct.scopes = c.scopes ?? []
  await ensureFreshToken(acct)
  await hydrateProfile(acct)

  const dupe = findEmailDupe(store, acct.email)
  if (dupe) return json(res, { error: `该账号已存在 (${acct.email},别名 "${dupe}")`, existingLabel: dupe }, 409)

  const finalLabel = (body.label && body.label.trim()) || autoLabel(store, acct.email?.split('@')[0])
  if (store.accounts[finalLabel]) return json(res, { error: `别名 "${finalLabel}" 已被占用` }, 409)
  acct.label = finalLabel
  store.accounts[finalLabel] = acct
  await saveStore(store)
  json(res, await collect(acct, store))
}

async function handleImportToken(req, res, _, body) {
  const { refreshToken } = body
  if (!refreshToken) return json(res, { error: 'refreshToken required' }, 400)
  const store = await loadStore()

  const tmpLabel = `__tmp_${randomBytes(4).toString('hex')}`
  const acct = emptyAccount(tmpLabel)
  acct.refreshToken = refreshToken
  await ensureFreshToken(acct)
  await hydrateProfile(acct)

  const dupe = findEmailDupe(store, acct.email)
  if (dupe) return json(res, { error: `该账号已存在 (${acct.email},别名 "${dupe}")`, existingLabel: dupe }, 409)

  const finalLabel = (body.label && body.label.trim()) || autoLabel(store, acct.email?.split('@')[0])
  if (store.accounts[finalLabel]) return json(res, { error: `别名 "${finalLabel}" 已被占用` }, 409)
  acct.label = finalLabel
  store.accounts[finalLabel] = acct
  await saveStore(store)
  json(res, await collect(acct, store))
}

async function handleLoginStart(req, res, _, body) {
  const store = await loadStore()
  const labelHint = body.label && String(body.label).trim()
  if (labelHint && store.accounts[labelHint]) {
    return json(res, { error: `别名 "${labelHint}" 已被占用` }, 409)
  }

  const sessionId = randomBytes(16).toString('hex')
  const session = { status: 'pending', authUrl: null, result: null, error: null }
  pendingLogins.set(sessionId, session)

  runLoginFlow({ onOpen: u => { session.authUrl = u } })
    .then(async tokens => {
      const s = await loadStore()
      const tmpLabel = `__tmp_${randomBytes(4).toString('hex')}`
      const acct = emptyAccount(tmpLabel)
      Object.assign(acct, tokens)
      await hydrateProfile(acct)

      const dupe = findEmailDupe(s, acct.email)
      if (dupe) {
        session.status = 'error'
        session.error = `该账号已存在 (${acct.email},别名 "${dupe}")`
        return
      }

      const finalLabel = labelHint || autoLabel(s, acct.email?.split('@')[0])
      if (s.accounts[finalLabel]) {
        session.status = 'error'
        session.error = `别名 "${finalLabel}" 已被占用`
        return
      }
      acct.label = finalLabel
      s.accounts[finalLabel] = acct
      await saveStore(s)
      session.status = 'done'
      session.result = await collect(acct, { __dirty: false })
    })
    .catch(e => { session.status = 'error'; session.error = String(e.message || e) })

  setTimeout(() => pendingLogins.delete(sessionId), 10 * 60_000)
  json(res, { sessionId })
}

async function handleLoginStatus(req, res, m) {
  const [, sessionId] = m
  const s = pendingLogins.get(sessionId)
  if (!s) return json(res, { error: 'session not found' }, 404)
  json(res, s)
}

async function handlePatch(req, res, m, body) {
  const [, label] = m
  const store = await loadStore()
  const acct = store.accounts[label]
  if (!acct) return json(res, { error: 'not found' }, 404)
  if ('note' in body) acct.note = String(body.note ?? '')
  if ('googleEmail' in body) acct.googleEmail = String(body.googleEmail ?? '')
  if ('googlePassword' in body) acct.googlePassword = String(body.googlePassword ?? '')
  if ('twofaUrl' in body) acct.twofaUrl = String(body.twofaUrl ?? '')
  if ('tags' in body) {
    if (!Array.isArray(body.tags)) return json(res, { error: 'tags must be array' }, 400)
    acct.tags = body.tags.map(String).map(t => t.trim()).filter(Boolean).slice(0, 16)
  }
  if ('newLabel' in body && body.newLabel && body.newLabel !== label) {
    if (store.accounts[body.newLabel]) return json(res, { error: 'new label exists' }, 409)
    acct.label = body.newLabel
    store.accounts[body.newLabel] = acct
    delete store.accounts[label]
  }
  await saveStore(store)
  json(res, { ok: true })
}

async function handleDelete(req, res, m) {
  const [, label] = m
  const store = await loadStore()
  if (!store.accounts[label]) return json(res, { error: 'not found' }, 404)
  delete store.accounts[label]
  await saveStore(store)
  json(res, { ok: true })
}

export function startServer({ port = 7789, host = '127.0.0.1' } = {}) {
  const server = http.createServer(async (req, res) => {
    const u = new URL(req.url, `http://${req.headers.host}`)
    for (const [m, re, fn] of routes) {
      if (m !== req.method) continue
      const match = re.exec(u.pathname)
      if (!match) continue
      try {
        const body = (req.method === 'POST' || req.method === 'PATCH') ? await readBody(req) : {}
        await fn(req, res, match, body)
      } catch (e) {
        json(res, { error: String(e.message || e) }, 500)
      }
      return
    }
    res.statusCode = 404; res.end('not found')
  })
  return new Promise((resolve, reject) => {
    server.once('error', err => {
      if (err?.code === 'EADDRINUSE') {
        reject(new Error(`port ${port} is already in use on ${host}; try --port <N>`))
        return
      }
      reject(err)
    })
    server.listen(port, host, () => {
      const addr = server.address()
      console.error(`claude-accounts web ready → http://${host}:${addr.port}`)
      console.error(`store: ${STORE_PATH}`)
      resolve(server)
    })
  })
}
