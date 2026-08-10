"""文档上传与管理路由

端点：
  POST   /api/kbs/{kb_id}/docs/upload             — 上传文档
  GET    /api/kbs/{kb_id}/docs                    — 文档列表（?status= 过滤）
  GET    /api/kbs/{kb_id}/docs/{doc_id}           — 文档详情
  PUT    /api/kbs/{kb_id}/docs/{doc_id}           — 重命名文档
  DELETE /api/kbs/{kb_id}/docs/{doc_id}           — 删除文档
  GET    /api/kbs/{kb_id}/docs/{doc_id}/content   — 文档内容分页
  GET    /api/kbs/{kb_id}/docs/{doc_id}/page-image — 文档页图片（Phase 3）
"""

import os
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.database import get_db, SessionLocal
from ..models import KnowledgeBase, Document, DocumentPage
from ..schemas import (
    DocResponse, DocListResponse, DocDetailResponse,
    DocRenameRequest, DocContentResponse, DocPageResponse,
    PageImageResponse, SuccessResponse,
)
from ..services.chroma_service import get_chroma_service
from ..services.document_parser import parse_document, parse_document_pages, chunk_text
from ..services.embedding_service import get_embedding_service

router = APIRouter(prefix="/api/kbs/{kb_id}/docs", tags=["文档"])


def _process_document_background(doc_id: str, kb_id: str, file_path: str, filename: str):
    """后台任务：解析文档 → 分块 → Embedding → ChromaDB + SQLite 双写"""
    db = SessionLocal()
    try:
        doc = db.query(Document).filter(Document.id == doc_id).first()
        if not doc:
            return

        # 1. 逐页解析 → DocumentPage（阅读用，保留真实页码）
        pages = parse_document_pages(file_path)
        for page_num, page_text in pages:
            db.add(DocumentPage(
                doc_id=doc_id,
                page_num=page_num,
                text=page_text,
            ))
        doc.total_pages = len(pages)
        db.flush()

        # 2. 全文解析 → 分块 → ChromaDB（RAG 用，重叠 chunk 效果更好）
        full_text = parse_document(file_path)
        chunks = chunk_text(full_text, settings.CHUNK_SIZE, settings.CHUNK_OVERLAP)

        if not chunks:
            doc.status = "error"
            db.commit()
            return

        # 3. Embedding
        emb_service = get_embedding_service()
        embeddings = emb_service.embed(chunks)

        # 4. ChromaDB 写入
        metadatas = []
        for i, chunk in enumerate(chunks):
            metadatas.append({
                "kb_id": kb_id,
                "doc_id": doc_id,
                "doc_name": filename,
                "page_num": 0,  # chunk 无精确页码
                "chunk_index": i,
            })

        chroma_service = get_chroma_service()
        chroma_service.add_chunks(
            kb_id=kb_id,
            chunks=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
        )

        # 5. 更新文档状态
        doc.status = "ready"
        db.commit()

    except Exception as e:
        # 出错时标记文档状态
        try:
            doc = db.query(Document).filter(Document.id == doc_id).first()
            if doc:
                doc.status = "error"
                db.commit()
        except Exception:
            pass
        # 将错误信息写入文件日志便于调试
        import traceback
        print(f"[ERROR] 文档 {doc_id} 处理后失败: {e}")
        traceback.print_exc()
    finally:
        db.close()


def _doc_to_response(doc: Document) -> DocResponse:
    return DocResponse(
        doc_id=doc.id,
        filename=doc.filename,
        type=doc.file_type,
        pages=doc.total_pages,
        size=doc.file_size,
        status=doc.status,
        created_at=doc.created_at,
    )


def _doc_to_detail(doc: Document) -> DocDetailResponse:
    return DocDetailResponse(
        doc_id=doc.id,
        filename=doc.filename,
        type=doc.file_type,
        pages=doc.total_pages,
        size=doc.file_size,
        status=doc.status,
        created_at=doc.created_at,
        concept_refs=[],   # Phase 3
        chunk_count=0,     # Phase 1
    )


# ===== 上传 =====

@router.post("/upload", response_model=DocResponse, status_code=201)
async def upload_doc(
    kb_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """上传文档到指定知识库"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")

    # 提取文件信息
    filename = file.filename or "unknown"
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "unknown"
    allowed_types = {"pdf", "docx", "pptx", "txt", "md"}
    if ext not in allowed_types:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型: .{ext}")

    # 保存文件
    file_id = uuid.uuid4().hex[:12]
    saved_name = f"{file_id}.{ext}"
    saved_path = os.path.join(settings.UPLOAD_DIR, saved_name)

    content = await file.read()
    with open(saved_path, "wb") as f:
        f.write(content)

    # 创建数据库记录
    doc = Document(
        kb_id=kb_id,
        filename=filename,
        file_type=ext,
        file_path=saved_path,
        file_size=len(content),
        total_pages=0,
        status="processing",
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    # 触发后台处理：解析 → 分块 → Embedding → ChromaDB + SQLite
    background_tasks.add_task(
        _process_document_background,
        doc_id=doc.id,
        kb_id=kb_id,
        file_path=saved_path,
        filename=filename,
    )

    return _doc_to_response(doc)


# ===== 列表 =====

@router.get("", response_model=DocListResponse)
def list_docs(
    kb_id: str,
    status: str | None = Query(default=None, description="按状态过滤: processing|ready|error"),
    db: Session = Depends(get_db),
):
    """获取知识库下所有文档"""
    q = db.query(Document).filter(Document.kb_id == kb_id)
    if status:
        q = q.filter(Document.status == status)
    docs = q.order_by(Document.created_at.desc()).all()
    return DocListResponse(docs=[_doc_to_response(d) for d in docs])


# ===== 详情 =====

@router.get("/{doc_id}", response_model=DocDetailResponse)
def get_doc_detail(kb_id: str, doc_id: str, db: Session = Depends(get_db)):
    """获取文档详情"""
    doc = db.query(Document).filter(Document.id == doc_id, Document.kb_id == kb_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")
    return _doc_to_detail(doc)


# ===== 重命名 =====

@router.put("/{doc_id}", response_model=DocDetailResponse)
def rename_doc(kb_id: str, doc_id: str, body: DocRenameRequest, db: Session = Depends(get_db)):
    """重命名文档"""
    doc = db.query(Document).filter(Document.id == doc_id, Document.kb_id == kb_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")
    doc.filename = body.filename
    db.commit()
    db.refresh(doc)
    return _doc_to_detail(doc)


# ===== 删除 =====

@router.delete("/{doc_id}", response_model=SuccessResponse)
def delete_doc(kb_id: str, doc_id: str, db: Session = Depends(get_db)):
    """删除文档（同时删除源文件）"""
    doc = db.query(Document).filter(Document.id == doc_id, Document.kb_id == kb_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    # ChromaDB 向量同步删除
    chroma_service = get_chroma_service()
    chroma_service.delete_by_doc_id(kb_id, doc_id)

    # 删除物理文件
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    db.delete(doc)
    db.commit()
    return SuccessResponse(success=True)


# ===== 内容 =====

@router.get("/{doc_id}/content", response_model=DocContentResponse)
def get_doc_content(
    kb_id: str,
    doc_id: str,
    page: int = Query(default=1, ge=1),
    db: Session = Depends(get_db),
):
    """获取文档内容（分页）"""
    doc = db.query(Document).filter(Document.id == doc_id, Document.kb_id == kb_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    pages = (
        db.query(DocumentPage)
        .filter(DocumentPage.doc_id == doc_id)
        .order_by(DocumentPage.page_num)
        .all()
    )

    return DocContentResponse(
        pages=[DocPageResponse(page_num=p.page_num, text=p.text) for p in pages],
        total_pages=len(pages),
    )


# ===== Phase 3：页图片 =====

@router.get("/{doc_id}/page-image")
def get_page_image(
    kb_id: str,
    doc_id: str,
    page: int = Query(default=1, ge=1),
    db: Session = Depends(get_db),
):
    """获取文档页图片 — Phase 3 完整实现（PPT/PDF 图片场景）"""
    doc = db.query(Document).filter(Document.id == doc_id, Document.kb_id == kb_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")
    # TODO: Phase 3 — LibreOffice 预转 PNG + FileResponse 返回图片
    return PlainTextResponse("Not Implemented", status_code=501)
