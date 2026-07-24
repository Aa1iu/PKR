"""知识图谱路由

端点：
  GET    /api/kbs/{kb_id}/graph                       — 获取图谱数据
  GET    /api/kbs/{kb_id}/concepts/{concept_id}/positions — 概念位置映射（Phase 3）
  POST   /api/kbs/{kb_id}/analyze                     — 触发图谱分析（Phase 3）
  GET    /api/kbs/{kb_id}/analyze/status               — 分析任务状态（Phase 3）
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models import KnowledgeBase
from ..schemas import (
    GraphResponse, GraphNode, GraphEdge,
    ConceptPositionResponse, AnalyzeRequest, AnalyzeStatusResponse,
)

router = APIRouter(prefix="/api/kbs/{kb_id}", tags=["图谱"])


@router.get("/graph", response_model=GraphResponse)
def get_graph(kb_id: str, db: Session = Depends(get_db)):
    """获取知识图谱数据"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")

    # TODO: Phase 3 — 从 Concept + Relation 表构建图谱
    return GraphResponse(nodes=[], edges=[])


# ===== Phase 3 =====

@router.get("/concepts/{concept_id}/positions", response_model=ConceptPositionResponse)
def get_concept_positions(kb_id: str, concept_id: str, db: Session = Depends(get_db)):
    """获取概念在文档中的出现位置 — Phase 3"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    # TODO: Phase 3 — 从 ConceptDocRef 表查询位置
    return ConceptPositionResponse(concept_id=concept_id, concept_name="", positions=[])


@router.post("/analyze")
def trigger_analyze(kb_id: str, body: AnalyzeRequest = AnalyzeRequest(), db: Session = Depends(get_db)):
    """触发知识图谱异步分析 — Phase 3"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    # TODO: Phase 3 — BackgroundTasks 异步 LLM 概念提取 + 关系识别
    return {"kb_id": kb_id, "status": "started", "message": "Phase 3 实现"}


@router.get("/analyze/status", response_model=AnalyzeStatusResponse)
def get_analyze_status(kb_id: str, db: Session = Depends(get_db)):
    """查询分析任务状态 — Phase 3"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    # TODO: Phase 3 — 读取分析任务实际状态
    return AnalyzeStatusResponse(kb_id=kb_id, status="idle")
