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
import subprocess
import threading
import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..core.config import settings
from ..core.database import get_db, SessionLocal
from ..models import KnowledgeBase, Document, DocumentPage
from ..schemas import (
    DocResponse, DocListResponse, DocDetailResponse,
    DocRenameRequest, DocContentResponse, DocPageResponse,
    PageImageResponse, SuccessResponse, ConceptDocRefItem,
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

        # 6. 自动触发图谱分析（后台线程中开独立 event loop 执行，不阻塞上传返回）
        try:
            from ..services.graph_analyzer import get_analyzer
            import threading

            def _run_analysis():
                import asyncio
                asyncio.run(get_analyzer().run_analysis(kb_id))

            threading.Thread(target=_run_analysis, daemon=True).start()
            print(f"[INFO] 文档 {doc_id} 处理完成，已自动触发知识库 {kb_id} 图谱分析")
        except Exception as e:
            print(f"[WARN] 自动触发图谱分析失败（不影响文档入库）: {e}")

    except Exception as e:
        # 出错时标记文档状态（rollback 丢弃未提交的 pages，
        # 避免与并发删除操作产生 FK 冲突）
        try:
            db.rollback()
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


# ===== PPT 转图片（LibreOffice → PDF → PNG 缓存） =====

# LibreOffice 安装路径（个人项目硬编码，环境变化时修改此处）
SOFFICE_PATH = "C:/Program Files/LibreOffice/program/soffice.exe"
PPT_CACHE_DIR = os.path.join(os.path.dirname(settings.UPLOAD_DIR), "ppt_cache")
_ppt_lock = threading.Lock()  # 并发首转保护


def _ensure_ppt_images(doc: Document) -> str | None:
    """将 PPTX 转为 PNG 缓存目录，返回缓存目录路径；失败返回 None"""
    cache_dir = os.path.join(PPT_CACHE_DIR, doc.id)
    if os.path.exists(os.path.join(cache_dir, "page_1.png")):
        return cache_dir  # 已转换（缓存命中）

    with _ppt_lock:
        # 双检：等锁后可能已被其他请求转换
        if os.path.exists(os.path.join(cache_dir, "page_1.png")):
            return cache_dir

        os.makedirs(cache_dir, exist_ok=True)
        try:
            # 1. LibreOffice: pptx → pdf（一次转换全部页，比逐页转 PNG 可靠）
            if not os.path.exists(SOFFICE_PATH):
                return None
            subprocess.run(
                [SOFFICE_PATH, "--headless", "--convert-to", "pdf",
                 "--outdir", cache_dir, doc.file_path],
                timeout=180, capture_output=True, check=True,
            )
            # 2. PyMuPDF: pdf → 每页 PNG
            pdf_name = os.path.splitext(os.path.basename(doc.file_path))[0] + ".pdf"
            pdf_path = os.path.join(cache_dir, pdf_name)
            if not os.path.exists(pdf_path):
                return None

            import fitz
            pdf = fitz.open(pdf_path)
            for i, page in enumerate(pdf, 1):
                pix = page.get_pixmap(dpi=120)  # 120 DPI：清晰度与体积平衡
                pix.save(os.path.join(cache_dir, f"page_{i}.png"))
            pdf.close()
            return cache_dir
        except Exception:
            return None


def reindex_kb_documents(kb_id: str) -> int:
    """重建 KB 所有文档的向量索引，返回处理文档数

    清空该 KB 的 ChromaDB collection → 对每个 ready 文档重新
    执行解析→分块→Embedding→入库。
    """
    db = SessionLocal()
    docs = (
        db.query(Document)
        .filter(Document.kb_id == kb_id, Document.status == "ready")
        .all()
    )
    db.close()

    chroma_service = get_chroma_service()
    chroma_service.delete_by_kb_id(kb_id)  # 清空旧向量

    for d in docs:
        if os.path.exists(d.file_path):
            _process_document_background(d.id, kb_id, d.file_path, d.filename)
    return len(docs)


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


def _doc_to_detail(doc: Document, db: Session | None = None) -> DocDetailResponse:
    """文档详情：填充 concept_refs（关联概念）和 chunk_count（向量块数）"""
    chunk_count = 0
    concept_refs = []

    # chunk_count：从 ChromaDB 按 doc_id 过滤计数
    try:
        chroma_service = get_chroma_service()
        collection = chroma_service.get_collection(doc.kb_id)
        results = collection.get(where={"doc_id": doc.id}, include=[])
        chunk_count = len(results["ids"])
    except Exception:
        pass  # ChromaDB 不可用时降级为 0

    # concept_refs：关联概念位置
    if db:
        from ..models import Concept, ConceptDocRef
        refs = (
            db.query(ConceptDocRef, Concept.name)
            .join(Concept, ConceptDocRef.concept_id == Concept.id)
            .filter(ConceptDocRef.doc_id == doc.id)
            .all()
        )
        concept_refs = [
            ConceptDocRefItem(
                doc_id=doc.id,
                doc_name=doc.filename,
                page_num=r.page_num,
                paragraph=r.paragraph,
            )
            for r, _name in refs
        ]

    return DocDetailResponse(
        doc_id=doc.id,
        filename=doc.filename,
        type=doc.file_type,
        pages=doc.total_pages,
        size=doc.file_size,
        status=doc.status,
        created_at=doc.created_at,
        concept_refs=concept_refs,
        chunk_count=chunk_count,
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
    return _doc_to_detail(doc, db)


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
    return _doc_to_detail(doc, db)


# ===== 删除 =====

def _cleanup_graph_on_doc_delete(db: Session, doc_id: str):
    """删除文档后同步清理图谱数据

    规则（多文档共享概念的完整语义）：
    - 概念仍被其他文档引用 → 保留概念，仅删除该文档的 ConceptDocRef
    - 概念无任何剩余引用 → 删除概念 + 所有关联边（source/target 任一被删则边删）
    """
    from sqlalchemy import or_
    from ..models import Concept, ConceptDocRef, Relation

    # 1. 找到引用该文档的概念
    concept_ids = [
        ref.concept_id
        for ref in db.query(ConceptDocRef).filter(ConceptDocRef.doc_id == doc_id).all()
    ]
    if not concept_ids:
        return

    # 2. 删除该文档的所有 ConceptDocRef
    db.query(ConceptDocRef).filter(ConceptDocRef.doc_id == doc_id).delete()

    # 3. 对每个受影响概念检查剩余引用
    for cid in concept_ids:
        remaining = (
            db.query(ConceptDocRef)
            .filter(ConceptDocRef.concept_id == cid)
            .count()
        )
        if remaining == 0:
            # 无剩余引用 → 删除概念及其所有关联边
            db.query(Relation).filter(
                or_(
                    Relation.source_concept_id == cid,
                    Relation.target_concept_id == cid,
                )
            ).delete()
            concept = db.query(Concept).filter(Concept.id == cid).first()
            if concept:
                db.delete(concept)


@router.delete("/{doc_id}", response_model=SuccessResponse)
def delete_doc(kb_id: str, doc_id: str, db: Session = Depends(get_db)):
    """删除文档（同时删除源文件 + 同步清理图谱）"""
    doc = db.query(Document).filter(Document.id == doc_id, Document.kb_id == kb_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    # ChromaDB 向量同步删除
    chroma_service = get_chroma_service()
    chroma_service.delete_by_doc_id(kb_id, doc_id)

    # 删除物理文件
    if os.path.exists(doc.file_path):
        os.remove(doc.file_path)

    # 图谱同步清理（概念无引用则删，有引用则保留）
    _cleanup_graph_on_doc_delete(db, doc_id)

    # 显式删除 DocumentPage（不依赖 ORM cascade，
    # 避免后台线程 flush 未提交时 cascade 失效导致 FK 冲突）
    db.query(DocumentPage).filter(DocumentPage.doc_id == doc_id).delete()

    db.delete(doc)
    db.commit()
    return SuccessResponse(success=True)


# ===== 内容 =====

@router.get("/{doc_id}/content", response_model=DocContentResponse)
def get_doc_content(
    kb_id: str,
    doc_id: str,
    page: int | None = Query(default=None, ge=1, description="不传=全部页，>0=单页"),
    db: Session = Depends(get_db),
):
    """获取文档内容（分页）

    不传 page（默认）：返回全部页
    page>0：返回指定单页
    """
    doc = db.query(Document).filter(Document.id == doc_id, Document.kb_id == kb_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    query = (
        db.query(DocumentPage)
        .filter(DocumentPage.doc_id == doc_id)
        .order_by(DocumentPage.page_num)
    )

    if page is not None:
        # 单页模式：返回该页（若页码超出范围返回空 pages）
        pages = query.filter(DocumentPage.page_num == page).all()
    else:
        pages = query.all()

    return DocContentResponse(
        pages=[DocPageResponse(page_num=p.page_num, text=p.text) for p in pages],
        total_pages=len(pages),
    )


# ===== 原始文件流（PDF iframe / DOCX mammoth / 下载用） =====

# 扩展名 → MIME type 映射
MIME_TYPES = {
    ".pdf": "application/pdf",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
}


@router.get("/{doc_id}/file")
def get_doc_file(
    kb_id: str,
    doc_id: str,
    db: Session = Depends(get_db),
):
    """返回文档原始文件（供 PDF iframe / DOCX mammoth / 浏览器查看）"""
    doc = db.query(Document).filter(
        Document.id == doc_id, Document.kb_id == kb_id
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")

    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="文件不存在于服务器")

    ext = os.path.splitext(doc.file_path)[1].lower()
    media_type = MIME_TYPES.get(ext, "application/octet-stream")

    # 浏览器原生可显示的类型（pdf 等）：不传 filename → 无 attachment 头 → 内嵌显示
    # 未知类型（octet-stream）：传 filename → 触发下载（合理行为）
    inline_types = {".pdf", ".md", ".txt"}
    if ext in inline_types:
        return FileResponse(doc.file_path, media_type=media_type)

    return FileResponse(
        doc.file_path,
        media_type=media_type,
        filename=doc.filename,
    )


# ===== Phase 3：页图片 =====

@router.get("/{doc_id}/page-image")
def get_page_image(
    kb_id: str,
    doc_id: str,
    page: int = Query(default=1, ge=1),
    db: Session = Depends(get_db),
):
    """获取文档页图片

    PPTX：LibreOffice 转 PDF → PyMuPDF 渲染 PNG（首次转换缓存，之后秒开）
    其他类型：降级返回源文件流
    """
    doc = db.query(Document).filter(Document.id == doc_id, Document.kb_id == kb_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="文档不存在")
    if not os.path.exists(doc.file_path):
        raise HTTPException(status_code=404, detail="文件不存在于服务器")

    # 非 PPTX：保持原降级（返回源文件）
    if doc.file_type != "pptx":
        return FileResponse(doc.file_path, media_type="application/octet-stream")

    # PPTX：LibreOffice 转换 PNG（缓存）
    cache_dir = _ensure_ppt_images(doc)
    if not cache_dir:
        raise HTTPException(status_code=500, detail="PPT 转换失败，请确认 LibreOffice 已安装")

    img_path = os.path.join(cache_dir, f"page_{page}.png")
    if not os.path.exists(img_path):
        raise HTTPException(status_code=404, detail="页码超出范围")
    return FileResponse(img_path, media_type="image/png")
