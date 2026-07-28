"""Embedding 服务封装（BGE-M3 本地 + Mock 测试模式）

通过环境变量 MOCK_EMBEDDING=true 启用 Mock 模式（测试用，无需下载模型）。
"""

import os
import hashlib


class EmbeddingService:
    """BGE-M3 本地 Embedding

    支持 Mock 模式（MOCK_EMBEDDING=true）：用文本 SHA256 生成确定性伪向量，
    维度保持 1024，保证相同文本产生相同向量。仅用于测试 ChromaDB 管线。
    """

    MOCK_DIM = 1024

    def __init__(self):
        self.model = None
        self._mock = os.getenv("MOCK_EMBEDDING", "").lower() == "true"

    def _load_model(self):
        if self.model is not None:
            return
        if self._mock:
            return  # Mock 模式不需要模型
        from FlagEmbedding import BGEM3FlagModel
        from ..core.config import settings
        self.model = BGEM3FlagModel(
            settings.EMBEDDING_MODEL,
            use_fp16=settings.EMBEDDING_DEVICE == "cuda",
        )

    def _mock_embed(self, text: str) -> list[float]:
        """用 SHA256 生成确定性 1024 维伪向量（测试用）"""
        h = hashlib.sha256(text.encode("utf-8")).digest()
        # 将 32 字节扩展到 1024 维
        vec = []
        for i in range(self.MOCK_DIM):
            b = h[i % len(h)]
            # 用位置偏移做简单的确定性扰动
            val = ((b + i * 7) % 256) / 128.0 - 1.0  # 范围 [-1, 1]
            vec.append(val)
        # 归一化
        norm = sum(v * v for v in vec) ** 0.5
        return [v / norm for v in vec] if norm > 0 else vec

    def embed(self, texts: list[str]) -> list[list[float]]:
        """批量文本转向量"""
        if self._mock:
            return [self._mock_embed(t) for t in texts]
        self._load_model()
        return self.model.encode(texts)["dense_vecs"].tolist()

    def embed_query(self, query: str) -> list[float]:
        """单条查询转向量"""
        if self._mock:
            return self._mock_embed(query)
        self._load_model()
        return self.model.encode([query])["dense_vecs"].tolist()[0]


_embedding_service: EmbeddingService | None = None


def get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
