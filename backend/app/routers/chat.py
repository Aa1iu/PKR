"""对话路由（SSE 流式 + 对话历史）

端点：
  POST   /api/chat                           — AI 对话（SSE 流式，Phase 2）
  GET    /api/kbs/{kb_id}/chat/history       — 知识库对话历史（Phase 2）
  GET    /api/chat/history                   — 全局对话历史（Phase 2）
  DELETE /api/kbs/{kb_id}/chat/history       — 清除对话历史（Phase 2）

SSE 事件格式（Phase 2 完整实现）：
  data: {"type":"token",    "content":"..."}
  data: {"type":"source",   "sources":[{...}]}
  data: {"type":"done",     "message_id":"...","follow_up_questions":["..."]}
  data: {"type":"error",    "content":"错误描述"}
"""

import json
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models import KnowledgeBase
from ..schemas import ChatRequest, ChatHistoryResponse, SuccessResponse
from ..services.llm_service import get_llm_service

router = APIRouter(tags=["对话"])


# ===================== SSE 工具函数 =====================

async def _generate_sse(messages: AsyncGenerator[str, None]) -> AsyncGenerator[str, None]:
    """将 LLM 输出封装为 SSE text/event-stream（契约格式）"""
    async for chunk in messages:
        yield f"data: {json.dumps({'type': 'token', 'content': chunk})}\n\n"
    yield f"data: {json.dumps({'type': 'done', 'content': '', 'message_id': '', 'follow_up_questions': []})}\n\n"


# ===================== POST /api/chat =====================

@router.post("/api/chat")
async def chat(body: ChatRequest, db: Session = Depends(get_db)):
    """AI 对话（SSE 流式）— Phase 2 完整实现

    通过 context_type 区分三种场景：
    - doc:    基于指定文档上下文回答
    - kb:     基于指定知识库上下文回答
    - global: 全局对话，不限定知识库
    """
    kb = None
    context = ""

    if body.context_type in ("doc", "kb"):
        if not body.kb_id:
            raise HTTPException(status_code=422, detail="doc/kb 场景必须提供 kb_id")
        kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == body.kb_id).first()
        if not kb:
            raise HTTPException(status_code=404, detail="知识库不存在")
        context = f"用户正在知识库「{kb.name}」中提问。"
        if body.context_type == "doc" and body.doc_id:
            context += f" 当前查看的文档ID: {body.doc_id}，页码: {body.page or '未知'}。"
    elif body.context_type == "global":
        context = "用户正在进行全局知识问答。可以综合所有知识和常识回答。"

    # TODO: Phase 2 — 集成 RAG 检索上下文（ChromaDB 向量检索 → 拼入 Prompt）

    llm = get_llm_service()

    async def stream():
        async for chunk in llm.chat_stream(body.question, context):
            yield chunk

    return StreamingResponse(
        _generate_sse(stream()),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ===================== 对话历史（Phase 2 占位） =====================

@router.get("/api/kbs/{kb_id}/chat/history", response_model=ChatHistoryResponse)
def get_kb_chat_history(kb_id: str, db: Session = Depends(get_db)):
    """获取知识库对话历史 — Phase 2"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    # TODO: Phase 2 — 从 ChatMessage 表读取 kb_id 匹配的消息
    return ChatHistoryResponse(kb_id=kb_id, messages=[])


@router.get("/api/chat/history", response_model=ChatHistoryResponse)
def get_global_chat_history(db: Session = Depends(get_db)):
    """获取全局对话历史 — Phase 2"""
    # TODO: Phase 2 — 从 ChatMessage 表读取 kb_id IS NULL 的消息
    return ChatHistoryResponse(kb_id=None, messages=[])


@router.delete("/api/kbs/{kb_id}/chat/history", response_model=SuccessResponse)
def clear_kb_chat_history(kb_id: str, db: Session = Depends(get_db)):
    """清除知识库对话历史 — Phase 2"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    # TODO: Phase 2 — 删除 ChatMessage 表中 kb_id 匹配的记录
    return SuccessResponse(success=True)
