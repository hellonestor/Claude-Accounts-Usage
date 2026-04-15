# claude-accounts

多账号 Claude Pro / Max 用量监控。CLI · 本地 Web UI · 桌面应用,共享同一份账号池。

Anthropic 对 Pro/Max 订阅没有 Admin API,本项目直接调用 Claude Code CLI 使用的 3 个未公开 OAuth 端点汇总所有账号用量。

## 安装

**桌面应用**:[Releases](https://github.com/hellonestor/Claude-Accounts-Usage/releases/latest) 下载 AppImage / deb / dmg / exe。

**源码**(Node ≥ 18,无需 `npm install`):

```bash
git clone https://github.com/hellonestor/Claude-Accounts-Usage.git
cd Claude-Accounts-Usage
chmod +x bin/claude-accounts.mjs
```

## 使用

```bash
claude-accounts login <label>     # 浏览器 OAuth 登录
claude-accounts import <label>    # 从 ~/.claude/.credentials.json 导入
claude-accounts list              # 查看所有账号用量
claude-accounts watch             # 每 300s 轮询
claude-accounts serve             # http://127.0.0.1:7789
claude-accounts remove <label>
claude-accounts where
```

## 打包

```bash
npm run build              # 当前平台
npm run build:linux        # AppImage + deb
npm run build:mac          # dmg + zip     (需 macOS)
npm run build:win          # nsis + exe    (需 Windows 或 Wine)
```

推 `v*.*.*` tag 触发 GitHub Actions 三平台并行发版。详见 [`docs/PACKAGING.md`](./docs/PACKAGING.md)。

## 数据

- 默认:`~/.config/claude-accounts/accounts.json`(`0600`)
- 覆盖:`CLAUDE_ACCOUNTS_DIR=/path`

`refreshToken` 等同登录凭据,**不要**提交 git 或上云盘。

## 端点

| 用途 | 端点 |
|---|---|
| 用量 | `GET api.anthropic.com/api/oauth/usage` |
| Profile | `GET api.anthropic.com/api/oauth/profile` |
| Token | `POST platform.claude.com/v1/oauth/token` |
| 授权 | `claude.com/cai/oauth/authorize` |

均为 Anthropic 未公开 API,轮询过密会 429,schema 可能变更。

## License

[MIT](./LICENSE)
