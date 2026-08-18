# PKR 后端镜像
# 构建上下文：backend/ 目录
FROM python:3.11-slim

WORKDIR /app

# 系统依赖（PyMuPDF 等纯 wheel 包不需要额外系统库）
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 应用代码
COPY app ./app

# 数据目录（SQLite + ChromaDB + uploads，通过卷持久化）
RUN mkdir -p /app/data

# 容器内默认 CPU 推理；有 GPU 时可在 compose 中覆盖
ENV EMBEDDING_DEVICE=cpu
# 模型缓存目录（挂载宿主机缓存可避免重复下载 BGE-M3）
ENV HF_HOME=/root/.cache/huggingface

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
