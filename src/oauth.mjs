import { createHash, randomBytes } from 'node:crypto'
import http from 'node:http'
import { spawn } from 'node:child_process'
import {
  TOKEN_URL, CLAUDE_AI_AUTHORIZE_URL, CLIENT_ID, OAUTH_BETA,
  ALL_OAUTH_SCOPES, CLAUDE_AI_OAUTH_SCOPES,
  USAGE_ENDPOINT, PROFILE_ENDPOINT,
} from './constants.mjs'

// ---------- PKCE helpers (mirrors src/services/oauth/crypto.ts) ----------
const b64url = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
export const genVerifier  = () => b64url(randomBytes(32))
export const genChallenge = v => b64url(createHash('sha256').update(v).digest())
export const genState     = () => b64url(randomBytes(32))

// ---------- token flows (mirrors src/services/oauth/client.ts) ----------
export async function exchangeCodeForTokens({ code, state, verifier, port }) {
  return postJson(TOKEN_URL, {
    grant_type: 'authorization_code',
    code, state, code_verifier: verifier,
    redirect_uri: `http://localhost:${port}/callback`,
    client_id: CLIENT_ID,
  })
}

export async function refreshTokens(refreshToken) {
  return postJson(TOKEN_URL, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
    scope: CLAUDE_AI_OAUTH_SCOPES.join(' '),
  })
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${url} ${res.status}: ${await res.text()}`)
  return res.json()
}

// ---------- API calls ----------
export async function fetchUsage(accessToken) {
  const r = await fetch(USAGE_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}`, 'anthropic-beta': OAUTH_BETA },
  })
  if (!r.ok) throw new Error(`usage ${r.status}: ${await r.text()}`)
  return r.json()
}

export async function fetchProfile(accessToken) {
  const r = await fetch(PROFILE_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!r.ok) throw new Error(`profile ${r.status}: ${await r.text()}`)
  return r.json()
}

// ---------- refresh-as-needed wrapper ----------
export async function ensureFreshToken(acct) {
  const expiringSoon = !acct.expiresAt || acct.expiresAt - Date.now() < 5 * 60_000
  if (!expiringSoon) return { refreshed: false, token: acct.accessToken }
  if (!acct.refreshToken) throw new Error('no refreshToken stored; run `login` again')
  const d = await refreshTokens(acct.refreshToken)
  acct.accessToken  = d.access_token
  acct.refreshToken = d.refresh_token || acct.refreshToken
  acct.expiresAt    = Date.now() + d.expires_in * 1000
  acct.scopes       = (d.scope || '').split(' ').filter(Boolean)
  return { refreshed: true, token: acct.accessToken }
}

// ---------- interactive login (PKCE + localhost callback) ----------
export function buildAuthUrl({ codeChallenge, state, port }) {
  const url = new URL(CLAUDE_AI_AUTHORIZE_URL)
  url.searchParams.set('code', 'true')
  url.searchParams.set('client_id', CLIENT_ID)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', `http://localhost:${port}/callback`)
  url.searchParams.set('scope', ALL_OAUTH_SCOPES.join(' '))
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', state)
  return url.toString()
}

export async function runLoginFlow({ onOpen } = {}) {
  const verifier  = genVerifier()
  const challenge = genChallenge(verifier)
  const state     = genState()

  const { server, port, once } = await listenOnce()
  const authUrl = buildAuthUrl({ codeChallenge: challenge, state, port })
  onOpen?.(authUrl)
  tryOpenBrowser(authUrl)

  const { code, returnedState } = await once
  server.close()
  if (returnedState !== state) throw new Error('state mismatch — possible CSRF')

  const tok = await exchangeCodeForTokens({ code, state, verifier, port })
  return {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresAt: Date.now() + tok.expires_in * 1000,
    scopes: (tok.scope || '').split(' ').filter(Boolean),
  }
}

function listenOnce() {
  return new Promise((resolve, reject) => {
    const server = http.createServer()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port
      const once = new Promise((res, rej) => {
        server.on('request', (req, resp) => {
          const u = new URL(req.url, `http://localhost:${port}`)
          if (u.pathname !== '/callback') { resp.statusCode = 404; resp.end(); return }
          const code  = u.searchParams.get('code')
          const rstate= u.searchParams.get('state')
          const err   = u.searchParams.get('error')
          resp.setHeader('Content-Type', 'text/html; charset=utf-8')
          if (err || !code) {
            resp.end(`<h1>Login failed</h1><p>${err || 'no code'}</p>`)
            rej(new Error(err || 'no code in callback'))
            return
          }
          resp.end('<h1>Login complete</h1><p>You can close this tab.</p>')
          res({ code, returnedState: rstate })
        })
      })
      resolve({ server, port, once })
    })
  })
}

function tryOpenBrowser(url) {
  const cmds = process.platform === 'darwin' ? [['open', url]]
            : process.platform === 'win32'  ? [['cmd', '/c', 'start', '', url]]
            : [['xdg-open', url], ['sensible-browser', url], ['firefox', url]]
  for (const [bin, ...args] of cmds) {
    try { spawn(bin, args, { stdio: 'ignore', detached: true }).unref(); return } catch {}
  }
}
