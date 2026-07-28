"""语义检索路由

端点：
  POST /api/search — 向量语义检索（Phase 1 完整实现）
"""

from fastapi import APIRouter

from ..schemas import SearchRequest, SearchResponse, SearchResult
from ..services.chroma_service import get_chroma_service
from ..services.document_parser import jaccard_deduplicate
from ..services.embedding_service import get_embedding_service

router = APIRouter(prefix="/api", tags=["检索"])


@router.post("/search", response_model=SearchResponse)
def search(body: SearchRequest):
    """语义检索 — Phase 1 完整实现

    向量检索（ChromaDB）+ 词级 Jaccard 文本去重（>80% 相似则保留最高分）
    ChromaDB where={"kb_id": body.kb_id} 限定检索范围
    """
    # 1. 查询向量化
    emb_service = get_embedding_service()
    query_embedding = emb_service.embed_query(body.query)

    # 2. ChromaDB 向量检索
    chroma_service = get_chroma_service()
    raw_results = chroma_service.search(
        kb_id=body.kb_id,
        query_embedding=query_embedding,
        top_k=body.top_k,
    )

    # 3. 词级 Jaccard 去重
    deduped = jaccard_deduplicate(raw_results)

    # 4. 构造响应
    return SearchResponse(
        results=[
            SearchResult(
                chunk_text=r["chunk_text"],
                doc_name=r["doc_name"],
                page=r["page_num"],
                score=r["score"],
            )
            for r in deduped
        ]
    )
