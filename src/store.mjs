import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const defaultDir = path.join(os.homedir(), '.config/claude-accounts')
export const DATA_DIR = process.env.CLAUDE_ACCOUNTS_DIR || defaultDir
export const STORE_PATH = path.join(DATA_DIR, 'accounts.json')

export async function loadStore() {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8')
    return JSON.parse(raw)
  } catch (e) {
    if (e.code === 'ENOENT') return { accounts: {} }
    throw e
  }
}

export async function saveStore(store) {
  await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 })
  const tmp = STORE_PATH + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(store, null, 2), { mode: 0o600 })
  await fs.rename(tmp, STORE_PATH)
}

export function emptyAccount(label) {
  return {
    label,
    accessToken: null,
    refreshToken: null,
    expiresAt: 0,
    scopes: [],
    email: null,
    accountUuid: null,
    tier: null,
    hasMax: null,
    hasPro: null,
    addedAt: new Date().toISOString(),
    lastCheckedAt: null,
    note: '',
    tags: [],
    googleEmail: '',
    googlePassword: '',
    twofaUrl: '',
  }
}
