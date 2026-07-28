"""
文档入库脚本（Phase 1 验证用）

用法：
    python scripts/ingest.py <file_path> --kb-id <kb_id>

将文档解析、分块、embedding 后存入 ChromaDB，同时写入 SQLite。
"""

import argparse
import os
import sys

# 将 backend 加入路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.core.config import settings
from app.core.database import SessionLocal
from app.models import Document, DocumentPage
from app.services.chroma_service import get_chroma_service
from app.services.document_parser import parse_document, chunk_text, estimate_page_num
from app.services.embedding_service import get_embedding_service


def main():
    parser = argparse.ArgumentParser(description="文档入库")
    parser.add_argument("file_path", help="文档路径")
    parser.add_argument("--kb-id", required=True, help="目标知识库 ID")
    parser.add_argument("--chunk-size", type=int, default=500)
    parser.add_argument("--chunk-overlap", type=int, default=50)
    parser.add_argument("--no-db-write", action="store_true",
                        help="仅写入 ChromaDB，不写 SQLite（仅测试用）")
    args = parser.parse_args()

    file_path = args.file_path
    filename = os.path.basename(file_path)
    ext = os.path.splitext(file_path)[1].lower().lstrip(".")
    file_size = os.path.getsize(file_path)

    # ===== [1/4] 解析文档 =====
    print(f"[1/4] 解析文档: {file_path}")
    text = parse_document(file_path)
    chars_per_page_est = 800
    total_pages_est = max(1, len(text) // chars_per_page_est)
    print(f"  解析完成，共 {len(text)} 字符（估计 {total_pages_est} 页）")

    # ===== [2/4] 文本分块 =====
    print(f"[2/4] 文本分块 (chunk_size={args.chunk_size}, overlap={args.chunk_overlap})")
    chunks = chunk_text(text, args.chunk_size, args.chunk_overlap)
    print(f"  分块完成，共 {len(chunks)} 块")

    # ===== [3/4] SQLite 写入（创建文档记录） =====
    db = SessionLocal()
    doc_id = None

    if not args.no_db_write:
        print("[3/4] SQLite 写入文档记录...")
        doc = Document(
            kb_id=args.kb_id,
            filename=filename,
            file_type=ext,
            file_path=file_path,
            file_size=file_size,
            total_pages=total_pages_est,
            status="processing",
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        doc_id = doc.id
        print(f"  doc_id={doc_id}, status=processing")
    else:
        # 仅 ChromaDB 模式：生成临时 ID
        import uuid
        doc_id = uuid.uuid4().hex[:16]
        print("[3/4] 跳过 SQLite 写入（--no-db-write）")

    # ===== [4/4] Embedding + ChromaDB 写入 =====
    print("[4/4] Embedding + 入库 ChromaDB...")

    if not chunks:
        print("  [WARN] No text chunks, skipping embedding")
        if not args.no_db_write:
            doc.status = "error"
            db.commit()
        db.close()
        print("\n[OK] Done (no content to ingest)")
        return

    # 4a. 批量生成向量
    print(f"  生成 {len(chunks)} 个 Embedding...")
    emb_service = get_embedding_service()
    embeddings = emb_service.embed(chunks)
    print(f"  向量维度: {len(embeddings[0])}")

    # 4b. 构造元数据
    metadatas = []
    for i, chunk in enumerate(chunks):
        metadatas.append({
            "kb_id": args.kb_id,
            "doc_id": doc_id,
            "doc_name": filename,
            "page_num": estimate_page_num(i, args.chunk_size, chars_per_page_est),
            "chunk_index": i,
        })

    # 4c. 写入 ChromaDB
    print(f"  写入 ChromaDB (kb_id={args.kb_id})...")
    chroma_service = get_chroma_service()
    chroma_service.add_chunks(
        kb_id=args.kb_id,
        chunks=chunks,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    # 4d. 写入 SQLite DocumentPage（双写一致性）
    if not args.no_db_write:
        print(f"  写入 {len(chunks)} 条 DocumentPage 记录...")
        for i, chunk in enumerate(chunks):
            page = DocumentPage(
                doc_id=doc_id,
                page_num=metadatas[i]["page_num"],
                text=chunk,
            )
            db.add(page)

        doc.status = "ready"
        doc.total_pages = len(set(m["page_num"] for m in metadatas))  # 实际页数
        db.commit()
        print(f"  status=ready, total_pages={doc.total_pages}")

    db.close()

    # 验证
    count = chroma_service.count(args.kb_id)
    print(f"\n[OK] Done! KB {args.kb_id} now has {count} vectors")


if __name__ == "__main__":
    main()
