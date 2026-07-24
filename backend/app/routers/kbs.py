"""知识库 CRUD 路由

端点：
  GET    /api/kbs              — 知识库列表
  POST   /api/kbs              — 创建知识库
  PUT    /api/kbs/{kb_id}      — 更新知识库
  DELETE /api/kbs/{kb_id}      — 删除知识库（级联删除）
  GET    /api/kbs/{kb_id}/export   — 导出知识库 JSON（Phase 3）
  GET    /api/kbs/{kb_id}/search   — 全文搜索（Phase 1）
  POST   /api/kbs/{kb_id}/reindex  — 重建向量索引（Phase 2）
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models import KnowledgeBase, Document
from ..schemas import (
    KBCreate, KBUpdate, KBResponse, KBListResponse,
    KBExportResponse, FullTextSearchResponse, ReindexResponse,
    SuccessResponse, tags_to_list, tags_to_str,
)

router = APIRouter(prefix="/api/kbs", tags=["知识库"])


def _kb_to_response(kb: KnowledgeBase, doc_count: int | None = None) -> KBResponse:
    """ORM → KBResponse 统一转换"""
    if doc_count is None:
        doc_count = 0  # 调用方自行计算
    return KBResponse(
        id=kb.id,
        name=kb.name,
        description=kb.description or "",
        tags=tags_to_list(kb.tags),
        doc_count=doc_count,
        created_at=kb.created_at,
    )


@router.get("", response_model=KBListResponse)
def list_kbs(db: Session = Depends(get_db)):
    """获取所有知识库列表"""
    kbs = db.query(KnowledgeBase).all()
    items = []
    for kb in kbs:
        doc_count = db.query(Document).filter(Document.kb_id == kb.id).count()
        items.append(_kb_to_response(kb, doc_count))
    return KBListResponse(kbs=items)


@router.post("", response_model=KBResponse, status_code=201)
def create_kb(body: KBCreate, db: Session = Depends(get_db)):
    """创建知识库"""
    kb = KnowledgeBase(
        name=body.name,
        description=body.description,
        tags=tags_to_str(body.tags),
    )
    db.add(kb)
    db.commit()
    db.refresh(kb)
    return _kb_to_response(kb, doc_count=0)


@router.put("/{kb_id}", response_model=KBResponse)
def update_kb(kb_id: str, body: KBUpdate, db: Session = Depends(get_db)):
    """更新知识库（name/description/tags 均可选）"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")

    if body.name is not None:
        kb.name = body.name
    if body.description is not None:
        kb.description = body.description
    if body.tags is not None:
        kb.tags = tags_to_str(body.tags)

    db.commit()
    db.refresh(kb)

    doc_count = db.query(Document).filter(Document.kb_id == kb.id).count()
    return _kb_to_response(kb, doc_count)


@router.delete("/{kb_id}", response_model=SuccessResponse)
def delete_kb(kb_id: str, db: Session = Depends(get_db)):
    """删除知识库（级联删除文档、概念、关系、对话历史）"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    db.delete(kb)
    db.commit()
    return SuccessResponse(success=True)


# ===== Phase 3 =====

@router.get("/{kb_id}/export", response_model=KBExportResponse)
def export_kb(kb_id: str, db: Session = Depends(get_db)):
    """导出知识库结构为 JSON（Phase 3 完整实现）"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    # TODO: Phase 3 — 构建完整的 KBExportResponse（概念+关系+文档）
    return KBExportResponse(
        kb=_kb_to_response(kb, doc_count=0),
        concepts=[],
        relations=[],
        documents=[],
    )


# ===== Phase 1 =====

@router.get("/{kb_id}/search", response_model=FullTextSearchResponse)
def search_kb(
    kb_id: str,
    q: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    """知识库内全文搜索（Phase 1 完整实现）"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    # TODO: Phase 1 — SQL LIKE 分页全文搜索 DocumentPage.text
    return FullTextSearchResponse(results=[])


# ===== Phase 2 =====

@router.post("/{kb_id}/reindex")
def reindex_kb(kb_id: str, db: Session = Depends(get_db)):
    """重建向量索引（Phase 2 完整实现）"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    # TODO: Phase 2 — 异步执行 分块→Embedding→ChromaDB 重建
    return ReindexResponse(kb_id=kb_id, total_chunks=0, status="completed")
