"""RAG 检索增强生成服务

编排检索流程：查询向量化 → ChromaDB 语义检索 → 返回带来源标注的结果。
"""

from typing import Optional

from .chroma_service import get_chroma_service
from .embedding_service import get_embedding_service


class RAGService:
    """RAG 编排：检索 + 上下文构建"""

    def search_chunks(
        self,
        kb_id: str,
        query: str,
        top_k: int = 5,
        doc_id: Optional[str] = None,
    ) -> list[dict]:
        """向量语义检索相关文本块

        Args:
            kb_id: 知识库 ID
            query: 用户查询问题
            top_k: 返回结果数（1-20）
            doc_id: 限定文档 ID（doc 场景专用）

        Returns:
            [{chunk_text, doc_name, doc_id, page_num, chunk_index, score}, ...]
        """
        # 1. 查询向量化
        emb_service = get_embedding_service()
        query_embedding = emb_service.embed_query(query)

        # 2. ChromaDB 语义检索
        chroma_service = get_chroma_service()
        where_filter = {"doc_id": doc_id} if doc_id else None

        results = chroma_service.search(
            kb_id=kb_id,
            query_embedding=query_embedding,
            top_k=top_k,
            where=where_filter,
        )

        return results

    def build_context(
        self,
        kb_id: str,
        query: str,
        top_k: int = 5,
        doc_id: Optional[str] = None,
    ) -> tuple[list[dict], str]:
        """检索 + 构建 Prompt 上下文文本

        Returns:
            (sources, context_text)
            sources: 检索结果列表
            context_text: 拼接好的参考资料来源文本
        """
        sources = self.search_chunks(kb_id, query, top_k, doc_id)

        if not sources:
            return sources, ""

        lines = []
        for i, s in enumerate(sources, 1):
            lines.append(
                f"[来源{i}: 《{s['doc_name']}》第{s['page_num']}页] "
                f"{s['chunk_text']}"
            )

        return sources, "\n\n".join(lines)


# ==================== 单例 ====================

_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
