#!/usr/bin/env bash
# ============================================================
# PKR 后端启动脚本（Git Bash / Linux）
# 用法：bash scripts/start_backend.sh
# ============================================================
set -e
cd "$(dirname "$0")/../backend"

# --- 检查 DeepSeek API Key ---
if [ -z "$DEEPSEEK_API_KEY" ]; then
  echo "未检测到 DEEPSEEK_API_KEY 环境变量。"
  read -r -p "请输入 DeepSeek API Key（sk-...，直接回车则跳过）: " KEY_INPUT
  if [ -n "$KEY_INPUT" ]; then
    export DEEPSEEK_API_KEY="$KEY_INPUT"
    echo "（仅本次会话生效；永久生效请写入 ~/.bashrc：export DEEPSEEK_API_KEY=...）"
  fi
fi

# --- 无 GPU 时自动降级 CPU ---
if ! python -c "import torch; assert torch.cuda.is_available()" >/dev/null 2>&1; then
  echo "未检测到可用 GPU，Embedding 将以 CPU 模式运行（速度较慢）"
  export EMBEDDING_DEVICE=cpu
fi

# --- 激活 conda 环境（若存在）---
if command -v conda >/dev/null 2>&1; then
  conda activate pk_repo 2>/dev/null || true
fi

echo "启动后端服务：http://localhost:8000"
echo "Swagger 文档：http://localhost:8000/docs"
echo "按 Ctrl+C 停止"
echo

uvicorn app.main:app --reload --port 8000
