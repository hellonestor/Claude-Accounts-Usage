<div align="center">

# claude-accounts

**多账号 Claude Pro / Max 用量监控工作台**

一次登录,永久托管。CLI · 本地 Web UI · 桌面应用,三端共享同一份账号池。

[![Release](https://img.shields.io/github/v/release/hellonestor/Claude-Accounts-Usage?style=flat-square)](https://github.com/hellonestor/Claude-Accounts-Usage/releases)
[![CI](https://img.shields.io/github/actions/workflow/status/hellonestor/Claude-Accounts-Usage/release.yml?style=flat-square&label=build)](https://github.com/hellonestor/Claude-Accounts-Usage/actions)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square)](https://nodejs.org)
[![Platforms](https://img.shields.io/badge/platform-linux%20%7C%20macOS%20%7C%20windows-lightgrey?style=flat-square)]()

[English](#english) · [功能](#-功能) · [快速开始](#-快速开始) · [桌面应用](#️-桌面应用) · [端点来源](#-端点来源) · [FAQ](#-faq)

</div>

---

## 🎯 这是什么

Anthropic 没有给 Pro / Max 订阅用户提供 Admin API,也没有控制台查用量。
`claude-accounts` 直接调用 Anthropic 官方客户端(Claude Code CLI)使用的 3 个未公开 OAuth 端点,把你手上所有 Max / Pro 账号的 **5h / 7d / Opus / Sonnet / Extra 用量**统一汇总到一个面板。

- 🧩 **零运行时依赖** — 纯 ESM,`node >= 18` 即跑,CLI 核心不需要 `npm install`
- 🔄 **refreshToken 自动续签** — 刷新后立刻原子回写 store,无感维护
- 🖥️ **一份数据,三套界面** — CLI / 本地 Web UI / Electron 桌面包,全部复用同一 `accounts.json`
- 🔐 **本地优先** — 所有凭据以 `0600` 存在 `~/.config/claude-accounts/`,从不上传
- 📦 **一键打包** — GitHub Actions 并行在 Linux/macOS/Windows 构建 AppImage / deb / dmg / zip / nsis / portable

> ⚠️ 本项目仅复用端点常量,**不依赖** `claude-code-haha` 运行时代码。相关端点均为 Anthropic 未公开 API,可能随时变更或限流。

---

## ✨ 功能

| 类别 | 能力 |
|---|---|
| **用量监控** | 5 小时窗口、7 日窗口、Opus / Sonnet 占比、Extra Usage、下次重置时间 |
| **多账号管理** | 分组标签、本地备注、凭据备忘录(邮箱 / 密码 / 2FA URL 自动识别入库) |
| **录入方式** | 浏览器 OAuth(PKCE) · 从 `~/.claude/.credentials.json` 导入 |
| **Token 生命周期** | 自动刷新、原子回写、过期重入检测 |
| **界面** | 终端彩色表格 · 本地 Web UI · Electron 桌面应用(含自动更新) |
| **打包** | AppImage · deb · dmg · zip · nsis · portable.exe |
| **可观测** | JSON 输出、`watch` 轮询(默认 300s,避免 429) |

---

## 📸 预览

```
LABEL   EMAIL                    5H                   7D                    OPUS   SONNET   EXTRA
alice   alice@example.com        █░░░░░░░░░  8%  4h   ░░░░░░░░░░  4% 6d 4h   —     8%       20330/20000
bob     bob@example.com          ██░░░░░░░░ 22% 2h    █░░░░░░░░░ 14% 5d 1h   3%    12%      0/20000
```

> Web UI / 桌面端截图见 [Releases](https://github.com/hellonestor/Claude-Accounts-Usage/releases) 页。

---

## 🚀 快速开始

### 安装

**方式 A · 下载桌面安装包(推荐普通用户)**

前往 [Releases](https://github.com/hellonestor/Claude-Accounts-Usage/releases/latest) 下载对应平台:

| 平台 | 产物 |
|---|---|
| Linux | `claude-accounts-<ver>-x64.AppImage` · `claude-accounts_<ver>_amd64.deb` |
| macOS | `claude-accounts-<ver>-x64.dmg` · `claude-accounts-<ver>-arm64.dmg` |
| Windows | `claude-accounts-Setup-<ver>.exe` · `claude-accounts-<ver>-portable.exe` |

**方式 B · 克隆源码(开发者)**

```bash
git clone https://github.com/hellonestor/Claude-Accounts-Usage.git
cd Claude-Accounts-Usage
chmod +x bin/claude-accounts.mjs
# 可选:链接到 PATH
ln -s "$PWD/bin/claude-accounts.mjs" ~/.local/bin/claude-accounts
```

### 添加第一个账号

```bash
# 浏览器 OAuth(推荐,在账号所属人机器上跑一次)
claude-accounts login alice

# 或从已登录过 claude-code 的机器导入
claude-accounts import alice
```

### 查看用量

```bash
claude-accounts list
claude-accounts list --json | jq .
claude-accounts watch --interval 600        # 10 分钟轮询一次
```

### 启动 Web UI

```bash
claude-accounts serve                       # http://127.0.0.1:7789
claude-accounts serve --port 8080 --host 0.0.0.0
```

启动前会探测端口:已有实例则复用,端口被其他进程占用则报错退出。

---

## 🖥️ 桌面应用

项目附带 Electron 包装,启动即 Web UI + 菜单栏 + **自动更新**。

### 本地构建(当前平台)

```bash
npm run build          # 等价 bash scripts/build.sh
```

脚本自动检查环境 → 栅格化图标 → 安装依赖 → 调用 `electron-builder` 产出对应平台包。产物落在 `dist/`。

| 命令 | 产物 | 宿主要求 |
|---|---|---|
| `npm run build:linux` | AppImage + deb | Linux |
| `npm run build:mac`   | dmg + zip (x64 + arm64) | macOS(Apple 工具链) |
| `npm run build:win`   | nsis + portable | Windows 或 Linux + Wine |

### CI 全平台发版

推 `v*.*.*` tag 即触发 `ubuntu-latest` / `macos-latest` / `windows-latest` 并行构建,产物自动 publish 到 GitHub Releases:

```bash
# 修改 package.json 里的版本号
git add -A && git commit -m "chore(release): bump to v1.2.3"
git tag v1.2.3
git push origin main
git push origin v1.2.3
```

详细打包与签名流程:[`docs/PACKAGING.md`](./docs/PACKAGING.md)

### 自动更新

- 启动时拉取 GitHub Releases 的 `latest*.yml`
- 发现新版本 → 页面顶部横幅「发现新版本 vX.Y.Z,正在后台下载」
- 下载完成 → 弹对话框「现在重启更新 / 稍后」
- 菜单「文件 → 检查更新...」手动触发
- `npm run electron:dev` 开发模式跳过更新

---

## 📡 端点来源

| 用途 | 端点 | 说明 |
|---|---|---|
| 5h / 7d 用量 | `GET https://api.anthropic.com/api/oauth/usage` + `anthropic-beta: oauth-2025-04-20` | 返回窗口用量、次级模型占比、重置时间 |
| 账号 profile | `GET https://api.anthropic.com/api/oauth/profile` | email / organization / subscription tier |
| Token 换 / 刷 | `POST https://platform.claude.com/v1/oauth/token` | 授权码换 token · refresh_token 续签 |
| PKCE 授权 URL | `https://claude.com/cai/oauth/authorize` | 浏览器跳转地址 |
| `client_id` | `9d1c250a-e61b-44d9-88ed-5944d1962f5e` | 官方 Claude Code CLI 客户端 ID |

三个端点均为 Anthropic **未公开** API,schema 可能变更,轮询过密会触发 429。

---

## 📂 项目结构

```
bin/claude-accounts.mjs         # CLI 入口,分发子命令
src/
├── constants.mjs               # 抽出的端点 / scope / client_id
├── oauth.mjs                   # PKCE + 换 / 刷 token + 调 API
├── store.mjs                   # accounts.json 原子读写(0600)
├── render.mjs                  # 终端表格 / 进度条 / 颜色(纯 ANSI)
├── commands.mjs                # 各子命令实现
├── server.mjs                  # Web UI HTTP 服务
├── web/index.html              # 单文件前端,无构建
└── electron/main.mjs           # 桌面应用 + 自动更新
scripts/build.sh                # 一键打包脚本
.github/workflows/release.yml   # CI:推 tag → 三平台并行发版
docs/PACKAGING.md               # 打包详解
```

---

## ⌨️ 所有子命令

| 命令 | 说明 |
|---|---|
| `login <label>` | 浏览器 OAuth 登录(PKCE) |
| `import <label>` | 从本机 `~/.claude/.credentials.json` 抽 token |
| `import-token <label>` | 手动粘贴 refreshToken(交互式) |
| `list [label] [--json]` | 查询一次用量 |
| `watch [--interval N]` | 每 N 秒刷新(默认 300,不建议 < 60) |
| `serve [--port N] [--host H]` | 启动本地 Web UI |
| `remove <label>` / `rm` | 从 store 删除账号 |
| `where` | 打印 `accounts.json` 路径 |

---

## 🔐 数据存放

- 默认路径:`~/.config/claude-accounts/accounts.json`(权限 `0600`)
- 覆盖:`CLAUDE_ACCOUNTS_DIR=/secure/path claude-accounts ...`

> **⚠ Warning** `refreshToken` 等同账号登录凭据。强烈建议把 `accounts.json` 放在加密卷 / gpg / 系统 keyring,**不要**提交 git、**不要**上云盘。

---

## ❓ FAQ

<details>
<summary><b>为什么 watch 默认 300 秒?</b></summary>

`/api/oauth/usage` 对 Max 账号轮询过密会 429 甚至短暂封 IP。参见 claude-code issue [#31637](https://github.com/anthropics/claude-code/issues/31637) / [#30930](https://github.com/anthropics/claude-code/issues/30930)。建议 ≥ 300s。
</details>

<details>
<summary><b>refreshToken 什么时候会失效?</b></summary>

- 改密 / 启用 2FA
- 登出所有设备
- 服务端吊销会话
- 长期未使用(经验值约 90 天)

失效后重新跑 `login <label>` 即可。
</details>

<details>
<summary><b>为什么不用 Admin API?</b></summary>

Admin API 需要 Enterprise 计划和 Admin key,个人 Pro / Max 订阅拿不到。这是目前唯一能看到真实用量的路径。
</details>

<details>
<summary><b>数据会不会上传到第三方?</b></summary>

不会。所有请求直连 `api.anthropic.com` / `platform.claude.com`。本项目不带任何遥测。
</details>

<details>
<summary><b>可以跑在 NAS / 服务器上吗?</b></summary>

可以。用 `claude-accounts serve --host 0.0.0.0 --port 7789`,但强烈建议套一层反向代理 + HTTP Basic / OAuth,否则任何能访问该端口的人都能看到你所有账号凭据。
</details>

---

## ⚠️ 风险与限制

- 端点非公开,Anthropic 可能随时改 schema 或下线
- 不代替 Admin API,只覆盖 Pro / Max 订阅场景
- `refreshToken` 丢失 = 账号完全暴露,务必妥善保管
- 使用本工具产生的违反 Anthropic ToS 的风险自担

---

## 🤝 贡献

欢迎 issue / PR。开发流程:

```bash
git clone https://github.com/hellonestor/Claude-Accounts-Usage.git
cd Claude-Accounts-Usage
npm install                          # 仅开发桌面端需要
npm run electron:dev                 # 本地调试 Electron
node bin/claude-accounts.mjs serve   # 只跑 Web UI
```

提交规范:[Conventional Commits](https://www.conventionalcommits.org/)
代码风格:纯 ESM · 无第三方 runtime 依赖(devDependencies 允许)

---

## 📄 License

[MIT](./LICENSE) © hellonestor

---

<a id="english"></a>

## English (TL;DR)

**claude-accounts** is a zero-dependency multi-account usage dashboard for Claude Pro / Max subscriptions. It reuses three undocumented OAuth endpoints from Anthropic's official Claude Code CLI to aggregate 5h / 7d / Opus / Sonnet usage across all your accounts in one pane — CLI, local web UI, and Electron desktop app share the same encrypted store. Node ≥ 18, no `npm install` needed for the CLI core. See sections above for install, commands, and endpoint references.
