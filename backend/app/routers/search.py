"""语义检索路由

端点：
  POST /api/search — 向量语义检索（Phase 1 完整实现）
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..schemas import SearchRequest, SearchResponse

router = APIRouter(prefix="/api", tags=["检索"])


@router.post("/search", response_model=SearchResponse)
def search(body: SearchRequest, db: Session = Depends(get_db)):
    """语义检索 — Phase 1 完整实现

    向量检索（ChromaDB）+ Jaccard 文本去重（>80% 相似则保留最高分）
    ChromaDB where={"kb_id": body.kb_id} 限定检索范围
    """
    # TODO: Phase 1 — ChromaDB 向量检索:
    #   1. embedding_service.embed_query(body.query)
    #   2. collection.query(query_embedding, n_results=body.top_k, where={"kb_id": body.kb_id})
    #   3. Jaccard 去重
    #   4. 返回 SearchResult 列表
    return SearchResponse(results=[])
