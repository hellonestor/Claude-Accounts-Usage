# 打包与发布

本项目用 **Electron + electron-builder** 打包成四类桌面应用：Linux `AppImage`/`deb`、macOS `dmg`/`zip`、Windows `exe`(NSIS 安装包 + portable)。自动更新走 **electron-updater** + GitHub Releases。

---

## 本地一键打包

```bash
./scripts/build.sh             # 自动识别当前 OS 构建
./scripts/build.sh linux       # AppImage + deb
./scripts/build.sh mac         # dmg + zip   (需在 macOS 上执行)
./scripts/build.sh win         # nsis + portable exe (需 Windows / Wine)
```

产物落在 `dist/`。脚本做的事:
1. 检查 `node >= 18`
2. 若有 ImageMagick / rsvg-convert，把 `data/claude.svg` 转成 `build/icon.png`(1024×1024);没有也能继续,只是图标变默认
3. `npm ci` / `npm install`
4. 调用 `electron-builder` 生成安装包

> **跨平台限制**:Linux 机器跑 `build.sh mac` 会失败(`dmg-license` / codesign 工具不存在);Windows exe 在 Linux 上可以靠 Wine 跑但不建议。推荐三个平台都交给 GitHub Actions 出包。

### 图标(可选但推荐)

把以下文件放进 `build/`,electron-builder 会自动选:
- `build/icon.png`  — 1024×1024,Linux + 兜底
- `build/icon.icns` — macOS
- `build/icon.ico`  — Windows

项目提供 `data/claude.svg` 作为来源,生成 `.icns` / `.ico` 需要 `png2icns` / `png-to-ico` 等工具,也可以一次手工生成后提交仓库。

---

## GitHub Actions 自动发布

工作流文件:`.github/workflows/release.yml`

### 触发方式

1. **推 tag 自动发布**:
   ```bash
   git tag v0.1.1
   git push --tags
   ```
   三个 runner(ubuntu/macos/windows)并行构建,产物自动上传到对应 GitHub Release。

2. **手动触发不发布(只构建)**:
   Actions → Release → Run workflow(`publish` 填 `false`)→ 下载 artifacts 做本地冒烟。

### 启用发布前必做

打开 `package.json`,把 `build.publish[0]` 中的 `owner` 从 `REPLACE_ME` 改成你的 GitHub 用户名/组织名,`repo` 改成实际仓库名。同一对值也需要出现在 `src/electron/main.mjs` 的"打开项目主页"菜单里。

macOS 公证 / Windows 代码签名留空时(`identity: null` / 无证书),跳过签名步骤。正式发布建议补证书,具体见 [electron-builder 文档](https://www.electron.build/code-signing)。

---

## 自动更新原理

1. 打包应用启动后,`electron-updater` 读取 `package.json → build.publish`,去 `https://github.com/<owner>/<repo>/releases/latest` 拉 `latest.yml` / `latest-mac.yml` / `latest-linux.yml`(随平台)。
2. 检测到新版本时:
   - 主进程触发 `update-available`,渲染进程收到 `window.dispatchEvent(new CustomEvent('app-update-available'))`,前端页面顶部出现蓝色横幅「发现新版本 vX.X.X,正在后台下载」。
   - 下载完成后弹系统原生对话框「新版本已就绪,是否重启安装」。
3. 开发模式 (`npm run electron:dev`) 跳过更新检查。

### 手动检查

菜单「文件 → 检查更新…」

---

## 版本号发布节奏

1. 改 `package.json → version`(语义化版本)
2. `git commit -am "release: v0.1.1"`
3. `git tag v0.1.1 && git push --tags`
4. 等 CI 跑完,Release 页面会自动附带四个平台的安装包 + `latest*.yml`
5. 老版本客户端下次启动就能看到更新横幅

---

## 常见问题

- **deb 安装后启动报 `libsecret` 错误**:`package.json > build.deb.depends` 已声明依赖,如果目标发行版包名不一样需要手动改。
- **macOS 拖进 Applications 后提示"已损坏"**:未签名 + 未公证应用的 Gatekeeper 警告,用户需右键 → 打开,或 `xattr -dr com.apple.quarantine /Applications/Claude\ 账号工作台.app`。
- **Windows SmartScreen 警告**:未代码签名时正常,用户点"更多信息 → 仍要运行"即可。签名后消失。
- **本地开发想验证 updater**:不行,开发模式下直接 skip。要验证需要先发一版 `v0.0.1`,再发 `v0.0.2`,本地装 v0.0.1 启动看横幅。
