#!/usr/bin/env bash
# 一键生成 Claude 账号工作台的全平台桌面应用
#
# 用法:
#   ./scripts/build.sh              # 尽可能生成当前宿主机能产出的所有平台包
#   ./scripts/build.sh linux        # 只出 AppImage + deb
#   ./scripts/build.sh mac          # 只出 dmg + zip    (需 macOS)
#   ./scripts/build.sh win          # 只出 nsis + portable exe
#   ./scripts/build.sh ci           # 打印 CI 触发指令,不在本机跑
#
# 限制:
#   - macOS 的 .dmg 必须在 macOS 主机上打(Apple 工具链限制)
#   - Windows 的 .exe 可以在 Linux 上通过 Wine 打,本脚本自动检测
#   - 本机跑不出来的平台,用 GitHub Actions 一键出(见末尾提示)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TARGET="${1:-auto}"

# ---------- 颜色 ----------
if [ -t 1 ]; then
  C_B="$(printf '\033[1m')"; C_G="$(printf '\033[32m')"; C_Y="$(printf '\033[33m')"
  C_R="$(printf '\033[31m')"; C_D="$(printf '\033[2m')"; C_N="$(printf '\033[0m')"
else
  C_B=""; C_G=""; C_Y=""; C_R=""; C_D=""; C_N=""
fi
say()  { printf "%s==>%s %s\n"  "$C_B"  "$C_N" "$*"; }
ok()   { printf "%s[OK]%s %s\n"  "$C_G"  "$C_N" "$*"; }
warn() { printf "%s[!]%s  %s\n"  "$C_Y"  "$C_N" "$*"; }
err()  { printf "%s[X]%s  %s\n"  "$C_R"  "$C_N" "$*" >&2; }

# ---------- 1. 环境检查 ----------
if ! command -v node >/dev/null 2>&1; then
  err "Node.js >= 18 未安装,先装 node 再重试"
  exit 1
fi
NODE_MAJOR="$(node -p 'parseInt(process.versions.node.split(".")[0], 10)')"
if [ "$NODE_MAJOR" -lt 18 ]; then
  err "Node.js 需要 >= 18,当前 $(node -v)"
  exit 1
fi
ok "Node $(node -v)"

HOST_OS="unknown"
case "$(uname -s)" in
  Linux*)  HOST_OS="linux" ;;
  Darwin*) HOST_OS="mac" ;;
  MINGW*|MSYS*|CYGWIN*|Windows_NT) HOST_OS="win" ;;
esac
ok "宿主平台: $HOST_OS"

# ---------- 2. 图标栅格化(best-effort) ----------
BUILD_DIR="$ROOT/build"
SVG="$ROOT/data/claude.svg"
mkdir -p "$BUILD_DIR"
if [ ! -f "$BUILD_DIR/icon.png" ] && [ -f "$SVG" ]; then
  say "把 data/claude.svg 栅格化成 build/icon.png (1024×1024)"
  if   command -v rsvg-convert >/dev/null 2>&1; then
    rsvg-convert -w 1024 -h 1024 "$SVG" -o "$BUILD_DIR/icon.png" || true
  elif command -v magick        >/dev/null 2>&1; then
    magick -background none "$SVG" -resize 1024x1024 "$BUILD_DIR/icon.png" || true
  elif command -v convert       >/dev/null 2>&1; then
    convert -background none "$SVG" -resize 1024x1024 "$BUILD_DIR/icon.png" || true
  else
    warn "未找到 rsvg-convert / ImageMagick,跳过图标生成(electron-builder 会用默认图标)"
  fi
fi
[ -f "$BUILD_DIR/icon.png" ] && ok "build/icon.png 就绪" || warn "build/icon.png 不存在"

# ---------- 3. 安装依赖 ----------
say "安装依赖"
if [ -f package-lock.json ]; then
  npm ci --silent
else
  npm install --silent
fi
ok "依赖安装完成"

# ---------- 4. 按目标调用 electron-builder ----------
declare -a BUILT=()
declare -a SKIPPED=()

run_linux() {
  say "构建 Linux (AppImage + deb)"
  npm run --silent dist:linux
  BUILT+=("linux: AppImage + deb")
}
run_mac() {
  if [ "$HOST_OS" != "mac" ]; then
    warn "跳过 macOS 构建:.dmg / .zip 必须在 macOS 主机上打 (Apple 工具链限制)"
    SKIPPED+=("mac (需 macOS 主机, 或用 GitHub Actions)")
    return 0
  fi
  say "构建 macOS (dmg + zip, x64 + arm64)"
  npm run --silent dist:mac
  BUILT+=("mac: dmg + zip")
}
run_win() {
  if [ "$HOST_OS" = "win" ]; then
    say "构建 Windows (nsis + portable)"
    npm run --silent dist:win
    BUILT+=("win: nsis + portable")
    return 0
  fi
  if command -v wine >/dev/null 2>&1; then
    say "Linux + Wine 检测到,构建 Windows (nsis + portable)"
    npm run --silent dist:win
    BUILT+=("win: nsis + portable (via Wine)")
  else
    warn "跳过 Windows 构建:当前机器非 Windows 且未安装 wine。装 Wine 后可本机出 exe,或用 GitHub Actions。"
    SKIPPED+=("win (需 Wine 或 Windows 主机, 或用 GitHub Actions)")
  fi
}

case "$TARGET" in
  linux)  run_linux ;;
  mac)    run_mac ;;
  win)    run_win ;;
  auto|all)
    run_linux
    run_win
    run_mac
    ;;
  ci)
    cat <<'EOM'
跳过本机构建。用 GitHub Actions 三 runner 一次出齐 Linux/Mac/Windows:

    git tag v$(node -p "require('./package.json').version")
    git push --tags

Tag 触发 .github/workflows/release.yml,产物会自动 publish 到 GitHub Releases。
首次请把 package.json > build.publish[0].owner 从 REPLACE_ME 改成你的 GitHub 账号。
EOM
    exit 0
    ;;
  *)
    err "未知目标: $TARGET"
    echo "usage: $0 [auto|linux|mac|win|ci]"
    exit 2
    ;;
esac

# ---------- 5. 总结 ----------
echo
say "产物清单 (dist/)"
if compgen -G "dist/*" >/dev/null; then
  ls -lh dist/ | awk 'NR>1 { printf "   %-12s %s\n", $5, $NF }'
else
  warn "dist/ 为空,检查上面输出排错"
fi

echo
ok  "已构建: ${BUILT[*]:-(无)}"
[ ${#SKIPPED[@]} -gt 0 ] && warn "已跳过: ${SKIPPED[*]}"

echo
printf "%s全部平台一键出包的最省事方式:%s 推 git tag vX.Y.Z,让 GitHub Actions 三 runner 并行出 Linux+Mac+Win。\n" "$C_B" "$C_N"
