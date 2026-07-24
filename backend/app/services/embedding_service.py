"""Embedding 服务封装（BGE-M3 本地）"""


class EmbeddingService:
    """BGE-M3 本地 Embedding"""

    def __init__(self):
        self.model = None  # 延迟加载

    def _load_model(self):
        if self.model is not None:
            return
        from FlagEmbedding import BGEM3FlagModel
        from ..core.config import settings
        self.model = BGEM3FlagModel(
            settings.EMBEDDING_MODEL,
            use_fp16=settings.EMBEDDING_DEVICE == "cuda",
        )

    def embed(self, texts: list[str]) -> list[list[float]]:
        """批量文本转向量"""
        self._load_model()
        return self.model.encode(texts)["dense_vecs"].tolist()

    def embed_query(self, query: str) -> list[float]:
        """单条查询转向量"""
        return self.embed([query])[0]


_embedding_service: EmbeddingService | None = None


def get_embedding_service() -> EmbeddingService:
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
    return _embedding_service
