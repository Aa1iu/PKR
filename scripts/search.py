"""
检索测试脚本（Phase 1 验证用）

用法：
    python scripts/search.py "<query>" --kb-id <kb_id>
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from app.services.chroma_service import get_chroma_service
from app.services.document_parser import jaccard_deduplicate
from app.services.embedding_service import get_embedding_service


def main():
    parser = argparse.ArgumentParser(description="知识库语义检索")
    parser.add_argument("query", help="检索查询")
    parser.add_argument("--kb-id", required=True, help="目标知识库 ID")
    parser.add_argument("--top-k", type=int, default=5)
    parser.add_argument("--no-dedup", action="store_true", help="跳过 Jaccard 去重")
    args = parser.parse_args()

    print(f"查询: \"{args.query}\"")
    print(f"知识库: {args.kb_id}")
    print(f"Top-K: {args.top_k}")
    print("-" * 60)

    # 1. 查询向量化
    print("[1/3] 查询向量化...")
    emb_service = get_embedding_service()
    query_emb = emb_service.embed_query(args.query)
    print(f"  向量维度: {len(query_emb)}")

    # 2. ChromaDB 检索
    print(f"[2/3] ChromaDB 检索 (kb_id={args.kb_id}, top_k={args.top_k})...")
    chroma_service = get_chroma_service()
    total = chroma_service.count(args.kb_id)
    print(f"  知识库共有 {total} 个向量块")

    results = chroma_service.search(
        kb_id=args.kb_id,
        query_embedding=query_emb,
        top_k=args.top_k,
    )

    # 3. Jaccard 去重
    if not args.no_dedup and results:
        before = len(results)
        results = jaccard_deduplicate(results)
        after = len(results)
        if before != after:
            print(f"[3/3] Jaccard 去重: {before} → {after} 条")
        else:
            print(f"[3/3] Jaccard 去重: 无重复")
    else:
        print(f"[3/3] 跳过去重")

    # 输出结果
    print("-" * 60)
    if not results:
        print("(无结果)")
    else:
        for i, r in enumerate(results, 1):
            snippet = r["chunk_text"][:120].replace("\n", " ")
            print(f"{i}. [{r['score']:.3f}] {r['doc_name']} P{r['page_num']}")
            print(f"   {snippet}...")
            print()

    # 如果结果不够多，提示可能原因
    if not results:
        kb_count = chroma_service.count(args.kb_id)
        if kb_count == 0:
            print("\n💡 提示：知识库中没有向量数据，请先运行 ingest.py 入库文档。")


if __name__ == "__main__":
    main()
