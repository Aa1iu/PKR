"""知识图谱路由

端点：
  GET    /api/kbs/{kb_id}/graph                       — 获取图谱数据（Phase 3 真实实现）
  GET    /api/kbs/{kb_id}/concepts/{concept_id}/positions — 概念位置映射（Phase 3）
  POST   /api/kbs/{kb_id}/analyze                     — 触发图谱分析（Phase 3 真实实现）
  GET    /api/kbs/{kb_id}/analyze/status               — 分析任务状态（Phase 3 真实实现）
"""

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models import KnowledgeBase, Concept, Relation
from ..schemas import (
    GraphResponse, GraphNode, GraphEdge,
    ConceptPositionResponse, AnalyzeRequest, AnalyzeStatusResponse,
)
from ..services.graph_analyzer import get_analyzer, get_status as get_analyze_status

router = APIRouter(prefix="/api/kbs/{kb_id}", tags=["图谱"])


# ==================== GET /graph ====================

@router.get("/graph", response_model=GraphResponse)
def get_graph(kb_id: str, db: Session = Depends(get_db)):
    """获取知识图谱数据 — Phase 3 真实实现

    从 Concept + Relation 表读取图谱数据。
    前端优先调 API，失败/空 → Mock 兜底。
    """
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")

    # 读取概念节点
    concepts = db.query(Concept).filter(Concept.kb_id == kb_id).all()

    # 计算每个节点的 degree
    concept_ids = {c.id for c in concepts}
    relations = db.query(Relation).filter(Relation.kb_id == kb_id).all()

    degree_map: dict[str, int] = {c.id: 0 for c in concepts}
    for r in relations:
        if r.source_concept_id in degree_map:
            degree_map[r.source_concept_id] += 1
        if r.target_concept_id in degree_map:
            degree_map[r.target_concept_id] += 1

    nodes = [
        GraphNode(
            id=c.id,
            name=c.name,
            definition=c.definition or "",
            type=c.concept_type or "其他",
            degree=degree_map.get(c.id, 0),
            doc_refs=[ref.doc_id for ref in c.doc_refs] if c.doc_refs else [],
        )
        for c in concepts
    ]

    edges = [
        GraphEdge(
            source=r.source_concept_id,
            target=r.target_concept_id,
            relation=r.relation_type,
            description=r.description or "",
        )
        for r in relations
    ]

    return GraphResponse(nodes=nodes, edges=edges)


# ==================== 概念位置（Phase 3 占位） ====================

@router.get("/concepts/{concept_id}/positions")
def get_concept_positions(kb_id: str, concept_id: str, db: Session = Depends(get_db)):
    """获取概念在文档中的出现位置 — 未实现（Phase 5 待做）"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    concept = db.query(Concept).filter(
        Concept.id == concept_id, Concept.kb_id == kb_id
    ).first()
    if not concept:
        raise HTTPException(status_code=404, detail="概念不存在")
    # 诚实返回 501，避免前端误以为有位置数据
    return PlainTextResponse("Not Implemented", status_code=501)


# ==================== 触发分析 ====================

@router.post("/analyze")
async def trigger_analyze(
    kb_id: str,
    background_tasks: BackgroundTasks,
    body: AnalyzeRequest | None = None,
    db: Session = Depends(get_db),
):
    """触发知识图谱异步分析 — Phase 3 真实实现

    异步执行 LLM 概念提取 + 去重合并 + 关系识别。
    立即返回 started，前端轮询 /analyze/status。
    """
    if body is None:
        body = AnalyzeRequest()

    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")

    analyzer = get_analyzer()
    background_tasks.add_task(analyzer.run_analysis, kb_id)

    return {"kb_id": kb_id, "status": "started"}


# ==================== 分析状态 ====================

@router.get("/analyze/status", response_model=AnalyzeStatusResponse)
def get_analyze_progress(kb_id: str, db: Session = Depends(get_db)):
    """查询分析任务状态 — Phase 3 真实实现"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")

    status = get_analyze_status(kb_id)
    return AnalyzeStatusResponse(
        kb_id=kb_id,
        status=status.get("status", "idle"),
        progress=status.get("progress", 0.0),
        current_step=status.get("current_step", ""),
        error=status.get("error"),
    )
