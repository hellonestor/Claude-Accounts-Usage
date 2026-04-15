# claude-accounts

独立的 Claude Pro/Max 多账号用量监控工具。**一次登录 → 永久托管**。
不依赖 `claude-code-haha` 运行时，只复用其中已验证可用的 3 个端点。

## 能做什么

- 把多个 Claude Max / Pro 订阅账号登记到同一台管理机
- 统一查看每个账号的 `5h` / `7d` / `opus` / `sonnet` / `extra_usage` 使用率和重置时间
- `refreshToken` 自动续签，使用者那边无需反复操作
- 无 npm 依赖，`node >= 18` 即可运行

## 端点来源（已实测）

| 用途 | 端点 | 出处 |
|---|---|---|
| 5h / 7d 用量 | `GET  https://api.anthropic.com/api/oauth/usage` + `anthropic-beta: oauth-2025-04-20` | `claude-code-haha/src/services/api/usage.ts` |
| 账号 email / tier | `GET  https://api.anthropic.com/api/oauth/profile` | `claude-code-haha/src/services/oauth/getOauthProfile.ts` |
| OAuth 换 / 刷 token | `POST https://platform.claude.com/v1/oauth/token` | `claude-code-haha/src/services/oauth/client.ts` |
| PKCE 授权 URL | `https://claude.com/cai/oauth/authorize` | 同上 |
| `client_id` | `9d1c250a-e61b-44d9-88ed-5944d1962f5e` | `claude-code-haha/src/constants/oauth.ts` |

三者都是 Anthropic **未公开**接口。可能随时变动或被限流（见 claude-code issue #31637 / #30930）。

## 安装

```bash
cd ~/workspace_bug/claude-accounts
chmod +x bin/claude-accounts.mjs
# 可选：软链到 PATH
ln -s "$PWD/bin/claude-accounts.mjs" ~/.local/bin/claude-accounts
```

## 管理一个账号（首次需一次登录）

三种录入方式，任选其一：

```bash
# 方式 1（推荐）：在"账号所属人"的机器上跑一次，全自动
claude-accounts login alice         # 弹浏览器 → 回调 → 自动存档

# 方式 2：该机器已登过 claude-code，直接抽 credentials.json
claude-accounts import alice

# 方式 3：别人告诉你 refreshToken，粘贴进来
claude-accounts import-token alice
```

## 查看所有账号用量

```bash
claude-accounts list
# LABEL  EMAIL                        5H                    7D                   OPUS  SONNET  EXTRA
# alice  alice@example.com            █░░░░░░░░░  8%  4h 0m ░░░░░░░░░░  4% 6d 4h -     8%     20330/20000
# bob    bob@example.com              ██░░░░░░░░ 22% 2h 15m █░░░░░░░░░ 14% 5d 1h 3%    12%    0/20000

claude-accounts list --json | jq .
claude-accounts watch --interval 600       # 每 10 分钟刷新一次（建议≥300s以免 429）
```

## 数据存放

默认路径：`~/.config/claude-accounts/accounts.json`，权限 `0600`。
用 `CLAUDE_ACCOUNTS_DIR=/secure/path claude-accounts ...` 可覆盖。

**安全提示**：`refreshToken` 等同账号登录凭据，强烈建议把 `accounts.json`
放在加密卷 / `gpg` / 系统 keyring 里，不要放 git、不要上云盘。

## 项目结构

```
bin/claude-accounts.mjs     # CLI 入口
src/
├── constants.mjs           # 从源码抽出的端点/scope/client_id
├── oauth.mjs               # PKCE + 换 token + 刷 token + 调 API
├── store.mjs               # accounts.json 读写（原子写 + 0600）
├── render.mjs              # 终端表格 / 进度条 / 颜色
└── commands.mjs            # 各子命令实现
data/                       # 兼容用，真实数据在 ~/.config/claude-accounts
```

## 风险与限制

1. 端点非公开 —— Anthropic 可能改 schema 或下线
2. `/api/oauth/usage` 对 Max 账号轮询太频会 `429`；`watch` 默认 5 分钟起
3. `refreshToken` 失效条件：改密 / 登出所有设备 / 服务端吊销 / 长期未用 → 需再跑一次 `login <label>`
4. 该工具不代替 Admin API：个人 Pro/Max 拿不到 Admin key，这是唯一路径
