// Extracted from claude-code-haha:
//   src/constants/oauth.ts      (BASE_API_URL, TOKEN_URL, CLIENT_ID, scopes, beta header)
//   src/services/oauth/client.ts (authorize URL shape, exchange/refresh bodies)
//   src/services/api/usage.ts    (usage endpoint)
//   src/services/oauth/getOauthProfile.ts (profile endpoint)

export const BASE_API_URL = 'https://api.anthropic.com'
export const TOKEN_URL = 'https://platform.claude.com/v1/oauth/token'
export const CLAUDE_AI_AUTHORIZE_URL = 'https://claude.com/cai/oauth/authorize'
export const CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e'
export const OAUTH_BETA = 'oauth-2025-04-20'

export const CLAUDE_AI_OAUTH_SCOPES = [
  'user:profile',
  'user:inference',
  'user:sessions:claude_code',
  'user:mcp_servers',
  'user:file_upload',
]

export const ALL_OAUTH_SCOPES = [
  'org:create_api_key',
  ...CLAUDE_AI_OAUTH_SCOPES,
]

export const USAGE_ENDPOINT   = `${BASE_API_URL}/api/oauth/usage`
export const PROFILE_ENDPOINT = `${BASE_API_URL}/api/oauth/profile`
