#!/usr/bin/env node
import * as cmds from '../src/commands.mjs'

const HELP = `claude-accounts — manage many Claude Pro/Max accounts, query 5h/7d usage

Commands:
  login <label>         Interactive OAuth login (opens browser). First-time setup.
  import <label>        Import tokens from ~/.claude/.credentials.json
  import-token <label>  Paste a refreshToken manually (stdin prompt)
  list [label] [--json] Query usage for all accounts (or one label)
  watch [--interval N]  Refresh continuously (default 300s)
  serve [--port N]      Start the local web UI at http://127.0.0.1:7789
  remove <label>        Delete an account from the store
  where                 Print path of the accounts.json store

Env:
  CLAUDE_ACCOUNTS_DIR   Override store directory (default ~/.config/claude-accounts)
`

const [cmd, ...rest] = process.argv.slice(2)
const table = {
  login: cmds.login,
  import: cmds.importLocal,
  'import-token': cmds.importToken,
  list: cmds.list,
  ls: cmds.list,
  watch: cmds.watch,
  serve: cmds.serve,
  web: cmds.serve,
  remove: cmds.remove,
  rm: cmds.remove,
  where: cmds.where,
  help: () => console.log(HELP),
  '-h': () => console.log(HELP),
  '--help': () => console.log(HELP),
}
const fn = table[cmd ?? 'help']
if (!fn) { console.error(HELP); process.exit(2) }
try { await fn(rest) }
catch (e) { console.error('ERROR:', e.message || e); process.exit(1) }
