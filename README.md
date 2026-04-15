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

## 本地 Web UI

```bash
claude-accounts serve                       # 默认 http://127.0.0.1:7789
claude-accounts serve --port 8080 --host 0.0.0.0
```

启动前会先探测端口：若已有 claude-accounts 实例在跑则直接复用，若端口被别的进程占用会报错退出。
页面提供账号列表、用量进度条、下次重置时间；数据来自同一份 `accounts.json`，与 CLI 共享刷新逻辑。

## 桌面应用 · 一键打包

项目同时提供 **Electron 桌面包装**，可打包成 AppImage / deb / dmg / exe 四类原生安装包，并内置 **自动更新提示**（基于 GitHub Releases）。

### 一键构建（当前机器）

```bash
npm run build           # 等价 ./scripts/build.sh
```

脚本自动做:
1. 检查 Node ≥ 18、识别宿主 OS
2. 把 `data/claude.svg` 栅格化成 `build/icon.png`（如装了 `rsvg-convert` / ImageMagick）
3. `npm ci` 装依赖
4. 根据宿主 OS 依次尝试：
   - **Linux 主机** → 产出 `AppImage` + `deb`
   - **macOS 主机** → 产出 `dmg` + `zip`（x64 + arm64）
   - **Windows 主机** 或 **Linux + Wine** → 产出 `nsis` 安装包 + `portable exe`
5. 产物落在 `dist/`

跨平台限制：macOS 的 `.dmg` 必须在 macOS 主机上打（Apple 工具链）；Linux 想出 Windows 包需装 `wine`。

### 只打单一平台

```bash
npm run build:linux     # AppImage + deb
npm run build:mac       # dmg + zip        （需 macOS）
npm run build:win       # nsis + portable  （需 Wine 或 Windows）
```

### 全平台一次出齐：用 GitHub Actions

`/.github/workflows/release.yml` 会在 `ubuntu-latest` / `macos-latest` / `windows-latest` 三台 runner 并行构建，推 tag 即触发：

```bash
git tag v0.1.1
git push --tags
# → 三平台并行构建 → 产物自动 publish 到 GitHub Releases
```

**首次发布前必改**：`package.json > build.publish[0].owner` 把 `REPLACE_ME` 改成你的 GitHub 账号，`repo` 改成实际仓库名。自动更新器靠这两个字段找 Releases。

### 自动更新提示

打包版启动时会自动调 `electron-updater` 拉 GitHub Releases 的 `latest*.yml`：

- **发现新版本** → 页面顶部出现蓝色横幅「发现新版本 vX.X.X，正在后台下载」
- **下载完成** → 弹系统对话框「现在重启更新 / 稍后」，选前者即时重启安装
- **手动检查** → 菜单「文件 → 检查更新…」
- 开发模式（`npm run electron:dev`）跳过更新检查

详见 `docs/PACKAGING.md`。

## 数据存放

默认路径：`~/.config/claude-accounts/accounts.json`，权限 `0600`。
用 `CLAUDE_ACCOUNTS_DIR=/secure/path claude-accounts ...` 可覆盖。

**安全提示**：`refreshToken` 等同账号登录凭据，强烈建议把 `accounts.json`
放在加密卷 / `gpg` / 系统 keyring 里，不要放 git、不要上云盘。

## 项目结构

```
bin/claude-accounts.mjs     # CLI 入口，分发子命令
src/
├── constants.mjs           # 从源码抽出的端点/scope/client_id
├── oauth.mjs               # PKCE + 换 token + 刷 token + 调 API
├── store.mjs               # accounts.json 读写（原子写 + 0600）
├── render.mjs              # 终端表格 / 进度条 / 颜色
├── commands.mjs            # 各子命令实现（login/import/list/watch/serve…）
├── server.mjs              # 本地 Web UI 的 HTTP 服务
├── web/index.html          # Web UI 前端（单文件，无构建）
└── electron/main.mjs       # 桌面应用入口（Electron 主进程 + 自动更新）
scripts/build.sh            # 一键打包脚本（npm run build）
.github/workflows/release.yml  # 推 tag → 三平台 CI 发包
docs/PACKAGING.md           # 打包与发布详细说明
data/                       # 兼容用，真实数据在 ~/.config/claude-accounts
```

## 全部子命令

| 命令 | 说明 |
|---|---|
| `login <label>` | 浏览器 OAuth 登录（PKCE） |
| `import <label>` | 从本机 `~/.claude/.credentials.json` 抽 token |
| `import-token <label>` | 手动粘贴 `refreshToken` |
| `list [label] [--json]` | 查询一次用量 |
| `watch [--interval N]` | 每 N 秒刷新一次（默认 300） |
| `serve [--port N] [--host H]` | 启动本地 Web UI（默认 127.0.0.1:7789） |
| `remove <label>` / `rm` | 从 store 中删除账号 |
| `where` | 打印 `accounts.json` 路径 |

## 风险与限制

1. 端点非公开 —— Anthropic 可能改 schema 或下线
2. `/api/oauth/usage` 对 Max 账号轮询太频会 `429`；`watch` 默认 5 分钟起
3. `refreshToken` 失效条件：改密 / 登出所有设备 / 服务端吊销 / 长期未用 → 需再跑一次 `login <label>`
4. 该工具不代替 Admin API：个人 Pro/Max 拿不到 Admin key，这是唯一路径
