"""知识图谱 AI 分析服务

LLM 概念提取 + 去重合并 + 关系识别 + 异步执行。
Phase 3 核心实现。
"""

import json
import logging
import re
from typing import Optional

from ..core.database import SessionLocal
from ..models import Concept, ConceptDocRef, Relation, DocumentPage, Document
from ..schemas import tags_to_list
from .embedding_service import get_embedding_service
from .llm_service import get_llm_service

logger = logging.getLogger(__name__)

# 分析任务状态（内存）
_analyze_status: dict[str, dict] = {}

RELATION_TYPES = ["前置依赖", "概念延伸", "对比关系", "包含关系", "应用关系"]
CONCEPT_TYPES = ["基础概念", "技术方法", "工具框架", "应用场景", "其他"]

# ==================== LLM Prompt 模板 ====================

PROMPT_EXTRACT_CONCEPTS = """你是一个知识图谱构建专家。请从以下文档片段中提取核心概念。

要求：
1. 每个概念包含 name（名称，<20字）、definition（定义，<80字）、type（类型）
2. type 必须从以下选择：基础概念、技术方法、工具框架、应用场景、其他
3. 提取 5-15 个最重要的概念，避免提取过于细枝末节的内容
4. 严格返回 JSON 数组格式

文档内容：
{chunks}

请直接返回 JSON 数组（不要 markdown 代码块）：
[{{"name": "概念名", "definition": "定义", "type": "基础概念"}}, ...]"""

PROMPT_IDENTIFY_RELATIONS = """你是一个知识图谱构建专家。请识别以下概念之间的知识关联。

已知概念：
{concepts}

关系类型（必须从以下选择）：
- 前置依赖：学A前应先学B
- 概念延伸：B是A的深化或扩展
- 对比关系：A与B是同类不同方案或对立
- 包含关系：A是B的组成部分
- 应用关系：A是B的应用场景

要求：
1. 每对概念最多一种关系
2. source 和 target 必须是上面列出的概念名称（精确匹配）
3. description 简洁说明（<50字）
4. 只返回有意义的关系，不要强行给所有概念对都找关系
5. 预计 3-10 条关系

请直接返回 JSON 数组：
[{{"source": "概念A", "target": "概念B", "relation_type": "前置依赖", "description": "说明"}}, ...]"""


# ==================== 核心服务 ====================

class GraphAnalyzer:
    """知识图谱 AI 分析器"""

    @staticmethod
    def _parse_json(text: str) -> list[dict]:
        """从 LLM 输出中提取 JSON 数组"""
        # 去掉可能的 markdown 代码块
        text = text.strip()
        if text.startswith("```"):
            text = re.sub(r"^```\w*\n", "", text)
            text = re.sub(r"\n```$", "", text)
        return json.loads(text)

    @staticmethod
    def _cosine_sim(a: list[float], b: list[float]) -> float:
        """余弦相似度"""
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    async def extract_concepts(
        self,
        chunks: list[str],
        max_chunks: int = 50,
    ) -> list[dict]:
        """LLM 概念提取"""
        # 控制输入量
        selected = chunks[:max_chunks]
        combined = "\n\n---\n\n".join(
            f"[片段{i+1}] {c[:500]}" for i, c in enumerate(selected)
        )

        llm = get_llm_service()
        messages = [
            {"role": "system", "content": "你是一个知识图谱构建专家。请严格按JSON格式输出。"},
            {"role": "user", "content": PROMPT_EXTRACT_CONCEPTS.format(chunks=combined)},
        ]

        result_text = await llm.chat_complete(
            messages, temperature=0.3, max_tokens=4000, json_mode=True
        )

        try:
            concepts = self._parse_json(result_text)
        except (json.JSONDecodeError, KeyError):
            # 重试一次
            result_text = await llm.chat_complete(
                messages, temperature=0.2, max_tokens=4000, json_mode=True
            )
            concepts = self._parse_json(result_text)

        # 校验 + 过滤
        valid = []
        for c in concepts:
            if isinstance(c, dict) and c.get("name") and c.get("definition"):
                c["type"] = c.get("type", "其他")
                if c["type"] not in CONCEPT_TYPES:
                    c["type"] = "其他"
                c["name"] = c["name"][:50]
                c["definition"] = c["definition"][:200]
                valid.append(c)
        return valid

    async def deduplicate_and_save(
        self,
        kb_id: str,
        new_concepts: list[dict],
        doc_ids: list[str],
    ) -> list[Concept]:
        """去重并写入 Concept 表"""
        db = SessionLocal()
        emb_service = get_embedding_service()

        # 获取已有概念
        existing = db.query(Concept).filter(Concept.kb_id == kb_id).all()

        # 已有概念的向量
        existing_names = [c.name for c in existing]
        existing_embs = emb_service.embed(existing_names) if existing_names else []

        saved: list[Concept] = []

        for nc in new_concepts:
            # 计算与已有概念的相似度
            new_emb = emb_service.embed_query(nc["name"])
            is_dup = False

            for i, ext_c in enumerate(existing):
                if existing_embs:
                    sim = self._cosine_sim(new_emb, existing_embs[i])
                    if sim > 0.85:
                        is_dup = True
                        saved.append(ext_c)
                        break

            if not is_dup:
                concept = Concept(
                    kb_id=kb_id,
                    name=nc["name"],
                    definition=nc.get("definition", ""),
                    concept_type=nc.get("type", "其他"),
                )
                db.add(concept)
                db.flush()  # 获取 ID
                saved.append(concept)
                existing.append(concept)
                existing_names.append(nc["name"])
                if existing_embs:
                    existing_embs.append(new_emb)

        # 关联 doc_refs
        for concept in saved:
            for doc_id in doc_ids[:3]:  # 最多关联 3 个文档
                ref = ConceptDocRef(
                    concept_id=concept.id,
                    doc_id=doc_id,
                    page_num=0,
                    paragraph=0,
                )
                db.add(ref)

        db.commit()
        concept_ids = [c.id for c in saved]
        db.close()
        return saved

    async def identify_relations(
        self,
        kb_id: str,
        concepts: list[Concept],
    ) -> list[dict]:
        """LLM 关系识别"""
        if len(concepts) < 2:
            return []

        # 概念列表文本
        concept_list = "\n".join(
            f"- {c.name}（{c.concept_type}）：{c.definition or ''}"
            for c in concepts[:30]
        )

        llm = get_llm_service()
        messages = [
            {"role": "system", "content": "你是一个知识图谱构建专家。请严格按JSON格式输出。"},
            {"role": "user", "content": PROMPT_IDENTIFY_RELATIONS.format(concepts=concept_list)},
        ]

        result_text = await llm.chat_complete(
            messages, temperature=0.3, max_tokens=4000, json_mode=True
        )

        try:
            relations = self._parse_json(result_text)
        except (json.JSONDecodeError, KeyError):
            result_text = await llm.chat_complete(
                messages, temperature=0.2, max_tokens=4000, json_mode=True
            )
            relations = self._parse_json(result_text)

        # 写入 Relation 表
        db = SessionLocal()
        name_to_id = {c.name: c.id for c in concepts}
        saved_count = 0

        for r in relations:
            if not isinstance(r, dict):
                continue
            source_id = name_to_id.get(r.get("source", ""))
            target_id = name_to_id.get(r.get("target", ""))
            rel_type = r.get("relation_type", "")

            if not source_id or not target_id or rel_type not in RELATION_TYPES:
                continue

            relation = Relation(
                kb_id=kb_id,
                source_concept_id=source_id,
                target_concept_id=target_id,
                relation_type=rel_type,
                description=r.get("description", "")[:200],
            )
            db.add(relation)
            saved_count += 1

        db.commit()
        db.close()
        return relations

    # ==================== 主流程 ====================

    async def run_analysis(self, kb_id: str):
        """执行完整的图谱分析流程（异步）"""
        _analyze_status[kb_id] = {
            "kb_id": kb_id,
            "status": "running",
            "progress": 0.0,
            "current_step": "初始化",
            "error": None,
        }

        try:
            # Step 1: 获取 chunk 文本
            _analyze_status[kb_id]["current_step"] = "读取文档内容"
            _analyze_status[kb_id]["progress"] = 0.1

            db = SessionLocal()
            pages = (
                db.query(DocumentPage, Document.filename)
                .join(Document, DocumentPage.doc_id == Document.id)
                .filter(Document.kb_id == kb_id)
                .all()
            )

            chunks = [p[0].text for p in pages if p[0].text]
            doc_ids = list(set(p[0].doc_id for p in pages))
            db.close()

            if not chunks:
                _analyze_status[kb_id]["status"] = "failed"
                _analyze_status[kb_id]["error"] = "知识库中没有文档内容"
                return

            # Step 2: 概念提取
            _analyze_status[kb_id]["current_step"] = "LLM 概念提取"
            _analyze_status[kb_id]["progress"] = 0.3
            new_concepts = await self.extract_concepts(chunks)

            # Step 3: 去重写入
            _analyze_status[kb_id]["current_step"] = "概念去重合并"
            _analyze_status[kb_id]["progress"] = 0.5
            saved_concepts = await self.deduplicate_and_save(
                kb_id, new_concepts, doc_ids
            )

            # Step 4: 关系识别
            _analyze_status[kb_id]["current_step"] = "LLM 关系识别"
            _analyze_status[kb_id]["progress"] = 0.7
            await self.identify_relations(kb_id, saved_concepts)

            _analyze_status[kb_id]["status"] = "completed"
            _analyze_status[kb_id]["progress"] = 1.0
            _analyze_status[kb_id]["current_step"] = "完成"

        except Exception as e:
            logger.exception(f"图谱分析失败 kb_id={kb_id}")
            _analyze_status[kb_id]["status"] = "failed"
            _analyze_status[kb_id]["error"] = str(e)


# ==================== 状态查询 ====================

def get_status(kb_id: str) -> dict:
    return _analyze_status.get(kb_id, {
        "kb_id": kb_id,
        "status": "idle",
        "progress": 0.0,
        "current_step": "",
        "error": None,
    })


# ==================== 单例 ====================

_analyzer: Optional[GraphAnalyzer] = None


def get_analyzer() -> GraphAnalyzer:
    global _analyzer
    if _analyzer is None:
        _analyzer = GraphAnalyzer()
    return _analyzer
