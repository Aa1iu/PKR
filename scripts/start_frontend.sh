#!/usr/bin/env bash
# ============================================================
# PKR 前端启动脚本（Git Bash / Linux）
# 用法：bash scripts/start_frontend.sh
# ============================================================
set -e
cd "$(dirname "$0")/../frontend"

if [ ! -d node_modules ]; then
  echo "[1/2] 首次运行，安装前端依赖..."
  npm install
else
  echo "[1/2] 依赖已安装，跳过"
fi

echo "[2/2] 启动前端开发服务器：http://localhost:5173"
echo "按 Ctrl+C 停止"
echo

npm run dev
