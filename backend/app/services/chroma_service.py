"""ChromaDB 向量存储管理服务

每个知识库对应一个 ChromaDB Collection（命名：kb_{kb_id}）。
提供向量的增、删、检索操作，所有写入附带元数据（kb_id, doc_id, doc_name, page_num, chunk_index）。
"""

import uuid
from typing import Optional

import chromadb
from chromadb.config import Settings as ChromaSettings

from ..core.config import settings


class ChromaService:
    """ChromaDB 封装：collection 管理 + 向量 CRUD"""

    def __init__(self):
        self._client = chromadb.PersistentClient(
            path=settings.CHROMA_PERSIST_DIR,
            settings=ChromaSettings(anonymized_telemetry=False),
        )

    # ==================== Collection 管理 ====================

    def _collection_name(self, kb_id: str) -> str:
        return f"kb_{kb_id}"

    def get_collection(self, kb_id: str):
        """获取或创建知识库对应的 collection"""
        name = self._collection_name(kb_id)
        return self._client.get_or_create_collection(name=name)

    def delete_collection(self, kb_id: str):
        """删除知识库对应的整个 collection"""
        name = self._collection_name(kb_id)
        try:
            self._client.delete_collection(name=name)
        except Exception:
            pass  # collection 不存在时不报错

    # ==================== 向量 CRUD ====================

    def add_chunks(
        self,
        kb_id: str,
        chunks: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
    ) -> list[str]:
        """批量写入文本块 + 向量 + 元数据到 ChromaDB

        Args:
            kb_id: 知识库 ID
            chunks: 文本块列表
            embeddings: 每块对应的向量（与 chunks 等长）
            metadatas: 每块的元数据，每项需含 kb_id, doc_id, doc_name, page_num, chunk_index

        Returns:
            chunk_ids: 每条记录的 ChromaDB ID 列表
        """
        if not chunks:
            return []

        collection = self.get_collection(kb_id)
        chunk_ids = [f"{meta.get('doc_id', 'unk')}_{meta.get('chunk_index', i)}"
                      for i, meta in enumerate(metadatas)]

        collection.add(
            ids=chunk_ids,
            documents=chunks,
            embeddings=embeddings,
            metadatas=metadatas,
        )
        return chunk_ids

    def search(
        self,
        kb_id: str,
        query_embedding: list[float],
        top_k: int = 5,
        where: Optional[dict] = None,
    ) -> list[dict]:
        """向量语义检索

        Args:
            kb_id: 知识库 ID
            query_embedding: 查询向量
            top_k: 返回结果数
            where: 额外的元数据过滤条件（如 {"doc_id": "xxx"}）

        Returns:
            [{chunk_text, doc_name, doc_id, page_num, chunk_index, score}, ...]
        """
        collection = self.get_collection(kb_id)

        col_count = collection.count()
        if col_count == 0 or top_k <= 0:
            return []

        # 构建 where 条件：始终限定 kb_id，可叠加额外条件
        filter_condition = {"kb_id": kb_id}
        if where:
            filter_condition.update(where)

        try:
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, col_count),
                where=filter_condition,
            )
        except Exception:
            return []

        if not results["ids"] or not results["ids"][0]:
            return []

        # 转换为统一格式
        output = []
        ids_list = results["ids"][0]
        docs_list = results["documents"][0]
        metas_list = results["metadatas"][0]
        distances_list = results["distances"][0]

        for i in range(len(ids_list)):
            meta = metas_list[i] if metas_list else {}
            distance = distances_list[i] if distances_list else 0.0
            # ChromaDB 默认用余弦距离，转换为 0~1 相似度分数
            score = 1.0 - min(distance / 2.0, 1.0)

            output.append({
                "chunk_text": docs_list[i] if docs_list else "",
                "doc_name": meta.get("doc_name", ""),
                "doc_id": meta.get("doc_id", ""),
                "page_num": meta.get("page_num", 0),
                "chunk_index": meta.get("chunk_index", 0),
                "score": round(score, 4),
            })

        return output

    def delete_by_doc_id(self, kb_id: str, doc_id: str):
        """按文档 ID 删除向量（文档删除时同步清理）"""
        try:
            collection = self.get_collection(kb_id)
            collection.delete(where={"doc_id": doc_id})
        except Exception:
            pass

    def delete_by_kb_id(self, kb_id: str):
        """删除整个知识库的向量数据"""
        self.delete_collection(kb_id)

    def count(self, kb_id: str) -> int:
        """返回知识库中的向量总数"""
        try:
            collection = self.get_collection(kb_id)
            return collection.count()
        except Exception:
            return 0


# ==================== 单例 ====================

_chroma_service: Optional[ChromaService] = None


def get_chroma_service() -> ChromaService:
    global _chroma_service
    if _chroma_service is None:
        _chroma_service = ChromaService()
    return _chroma_service
