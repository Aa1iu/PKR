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
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models import KnowledgeBase, Document, DocumentPage
from ..services.chroma_service import get_chroma_service
from ..schemas import (
    KBCreate, KBUpdate, KBResponse, KBListResponse,
    KBExportResponse, FullTextSearchResponse, FullTextSearchResult,
    ReindexResponse, SuccessResponse, tags_to_list, tags_to_str,
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
    """删除知识库（级联删除文档、概念、关系、对话历史 + ChromaDB 向量）"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    # ChromaDB 向量同步清理
    get_chroma_service().delete_by_kb_id(kb_id)
    db.delete(kb)
    db.commit()
    return SuccessResponse(success=True)


# ===== Phase 3 =====

@router.get("/{kb_id}/export")
def export_kb(kb_id: str, db: Session = Depends(get_db)):
    """导出知识库结构为 JSON — 未实现（Phase 5 待做）"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    # 诚实返回 501，避免前端误以为导出成功
    return PlainTextResponse("Not Implemented", status_code=501)


# ===== Phase 1 =====

@router.get("/{kb_id}/search", response_model=FullTextSearchResponse)
def search_kb(
    kb_id: str,
    q: str | None = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
):
    """知识库内全文搜索 — Phase 1 完整实现

    在 DocumentPage.text 中执行 SQL LIKE 匹配，返回匹配段落及来源文档信息。
    """
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")

    q = q.strip() if q else ""
    if not q:
        return FullTextSearchResponse(results=[])
    page_size = min(page_size, 100)

    # 关联查询：DocumentPage JOIN Document，限定 kb_id + LIKE 匹配
    search_term = f"%{q}%"
    rows = (
        db.query(DocumentPage, Document.filename)
        .join(Document, DocumentPage.doc_id == Document.id)
        .filter(Document.kb_id == kb_id, DocumentPage.text.like(search_term))
        .order_by(DocumentPage.page_num)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    results = []
    for doc_page, doc_name in rows:
        # 截取匹配位置周围的文本作为 snippet（最多 200 字符）
        text = doc_page.text or ""
        idx = text.lower().find(q.lower())
        start = max(0, idx - 50) if idx >= 0 else 0
        end = min(len(text), start + 200)
        snippet = ("..." if start > 0 else "") + text[start:end] + ("..." if end < len(text) else "")

        results.append(FullTextSearchResult(
            doc_id=doc_page.doc_id,
            doc_name=doc_name,
            page_num=doc_page.page_num,
            snippet=snippet,
        ))

    return FullTextSearchResponse(results=results)


# ===== Phase 2 =====

@router.post("/{kb_id}/reindex")
def reindex_kb(kb_id: str, db: Session = Depends(get_db)):
    """重建向量索引 — 未实现（Phase 5 待做）"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    # 诚实返回 501，避免前端误以为重建完成
    return PlainTextResponse("Not Implemented", status_code=501)
