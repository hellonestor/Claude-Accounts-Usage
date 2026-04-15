# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Zero-dependency Node (>=18) CLI + local web UI for monitoring multiple Claude Pro/Max accounts' 5h/7d/Opus/Sonnet usage from one place. Speaks Anthropic's **unofficial** OAuth endpoints directly — endpoints and constants were reverse-engineered from the `claude-code-haha` project (see `src/constants.mjs` header comments for exact source files).

## Running

```bash
npm start                           # same as node bin/claude-accounts.mjs
node bin/claude-accounts.mjs help   # command list
node bin/claude-accounts.mjs serve  # web UI at http://127.0.0.1:7789
node bin/claude-accounts.mjs list --json
```

No build, no tests, no linter. Pure ESM (`"type": "module"`, `.mjs`).

## Architecture

- `bin/claude-accounts.mjs` — tiny dispatcher, maps subcommand → `src/commands.mjs` export.
- `src/constants.mjs` — OAuth endpoints, `CLIENT_ID`, scopes, `anthropic-beta: oauth-2025-04-20`. **Do not change without verifying against `claude-code-haha` source**; these are the whole reason the tool works.
- `src/oauth.mjs` — PKCE flow, token exchange/refresh, usage/profile fetchers. All network calls live here.
- `src/store.mjs` — atomic read/write of `accounts.json` (mode `0600`). Store location: `$CLAUDE_ACCOUNTS_DIR` or `~/.config/claude-accounts/accounts.json`. The `data/` dir in-repo is a compat stub only — real data is in `$HOME/.config`.
- `src/commands.mjs` — one function per subcommand (`login`, `import`, `importToken`, `list`, `watch`, `serve`, `remove`, `where`). Auto-refreshes expired access tokens via `oauth.mjs` and persists rotated refresh tokens back to the store.
- `src/render.mjs` — terminal table/progress-bar/color helpers (no deps, raw ANSI).
- `src/server.mjs` + `src/web/index.html` — localhost HTTP server for the web UI. Read-only over account data; same auto-refresh path as the CLI.

## Working on this codebase

- Keep it dependency-free. The project's selling point is "no `npm install`". Don't add libraries.
- All three Anthropic endpoints (`/api/oauth/usage`, `/api/oauth/profile`, `platform.claude.com/v1/oauth/token`) are **undocumented and rate-limited** (~10 req/s, 429-prone on polling). Keep `watch`/UI refresh intervals ≥ 300s.
- `refreshToken` rotation: Anthropic returns a new `refresh_token` on each refresh — the store must be rewritten after every refresh (see existing code in `oauth.mjs` / `commands.mjs`).
- `refreshToken` == full account credential. Never log it, never echo it, never commit `accounts.json` or anything under `data/`.
- Bilingual project: README and UI strings are Chinese; code/comments are English. Match whichever surface you're editing.
