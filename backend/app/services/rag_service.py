"""RAG 检索增强生成服务"""

from typing import Optional


class RAGService:
    """RAG 编排：检索 + 上下文构建 + LLM 生成"""

    def __init__(self):
        self._chroma_client = None

    def search_chunks(
        self,
        kb_id: str,
        query: str,
        top_k: int = 5,
        doc_id: Optional[str] = None,
    ) -> list[dict]:
        """向量检索相关文本块"""
        # TODO: Phase 2 — ChromaDB 集成
        return []


_rag_service: RAGService | None = None


def get_rag_service() -> RAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
