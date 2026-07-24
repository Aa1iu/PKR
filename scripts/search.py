"""
检索测试脚本（Phase 1 验证用）

用法：
    python scripts/search.py "<query>" --kb-id <kb_id>
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))


def main():
    parser = argparse.ArgumentParser(description="知识库检索")
    parser.add_argument("query", help="检索查询")
    parser.add_argument("--kb-id", required=True, help="目标知识库 ID")
    parser.add_argument("--top-k", type=int, default=5)
    args = parser.parse_args()

    print(f"查询: \"{args.query}\"")
    print(f"知识库: {args.kb_id}")
    print(f"Top-K: {args.top_k}")
    print("-" * 50)

    # TODO: Phase 1 — ChromaDB 检索
    print("(TODO) ChromaDB 检索功能待 Phase 1 实现")


if __name__ == "__main__":
    main()
