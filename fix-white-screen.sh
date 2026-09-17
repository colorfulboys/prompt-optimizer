#!/bin/zsh
# 🇨🇳 2026-09-11 R54 白屏修复:vue.js hash mismatch
#  现象:ui/dist 里的 chunk 引用旧的 vue.js?v=1c5539a6,但 vite deps 已重 build 到 53d5789f
#  → SyntaxError: does not provide an export named 'defineComponent' → 白屏
# 修法:删 ui/dist 旧产物(让 vite 重 build) + 清 web/.vite 缓存 + 重启 dev server
set -e
ROOT="/Users/2023mbp/Desktop/M Code Workspace/简盒/简盒交接harness/02_简盒主站_fork"
echo "[1/4] 杀 18181 上的 vite 进程"
PID=$(lsof -tiTCP:18181 -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$PID" ]; then
  echo "    杀掉 PID=$PID"
  kill -9 $PID 2>/dev/null || true
  sleep 2
fi
echo "[2/4] 清 web/node_modules/.vite 缓存(包含损坏的 vue.js 入口)"
rm -rf "$ROOT/packages/web/node_modules/.vite" 2>/dev/null || true
echo "[3/4] 重建 ui/dist(用最新源码,LoginModal 密码框就在新 dist 里)"
cd "$ROOT" && pnpm -F @prompt-optimizer/ui build:bundle 2>&1 | tail -5
echo "    ui/dist 新产物:"
ls -la "$ROOT/packages/ui/dist/index.js" 2>/dev/null | awk '{print "      "$9" mtime="$6" "$7" "$8" size="$5}'
echo "[4/4] 启动 dev server"
cd "$ROOT" && pnpm -F @prompt-optimizer/web dev
