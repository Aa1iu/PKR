"""应用配置"""

import os
from pathlib import Path

# 项目根目录
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# 数据目录
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)


class Settings:
    APP_NAME: str = "PK Repository API"
    DEBUG: bool = True

    # 数据库
    SQLITE_URL: str = f"sqlite:///{DATA_DIR / 'pk_repo.db'}"

    # ChromaDB 向量存储路径
    CHROMA_PERSIST_DIR: str = str(DATA_DIR / "chroma")

    # 上传文件目录
    UPLOAD_DIR: str = str(DATA_DIR / "uploads")

    # DeepSeek API
    DEEPSEEK_API_KEY: str = os.getenv("DEEPSEEK_API_KEY", "your-api-key-here")
    DEEPSEEK_BASE_URL: str = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
    DEEPSEEK_MODEL: str = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")

    # Embedding
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "BAAI/bge-m3")
    EMBEDDING_DEVICE: str = os.getenv("EMBEDDING_DEVICE", "cuda")

    # 分块参数
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50


settings = Settings()

# 确保上传目录存在
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
