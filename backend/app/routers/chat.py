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
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..core.database import get_db, SessionLocal
from ..models import KnowledgeBase, Document, ChatMessage
from ..schemas import (
    ChatRequest, ChatHistoryResponse, ChatMessageResponse,
    ChatSource, SuccessResponse,
)
from ..services.llm_service import get_llm_service
from ..services.rag_service import get_rag_service

router = APIRouter(tags=["对话"])


# ==================== 对话历史（ChatMessage 表持久化） ====================

_MAX_HISTORY = 40  # 每个 KB 最多保留 40 条消息（20 轮）


def _get_history(kb_id: str | None, db: Session) -> list[dict]:
    """从 ChatMessage 表读取对话历史"""
    query = db.query(ChatMessage).order_by(ChatMessage.created_at)
    if kb_id:
        query = query.filter(ChatMessage.kb_id == kb_id)
    else:
        query = query.filter(ChatMessage.kb_id.is_(None))
    rows = query.limit(_MAX_HISTORY).all()

    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "sources": m.sources or [],
            "follow_up_questions": m.follow_up_questions or [],
            "created_at": m.created_at.isoformat() if m.created_at else None,
        }
        for m in rows
    ]


def _add_message(db: Session, kb_id: str | None, role: str, content: str,
                 sources: list[dict] | None = None,
                 follow_ups: list[str] | None = None) -> str:
    """写入 ChatMessage 表，返回消息 ID"""
    msg = ChatMessage(
        kb_id=kb_id,  # None=全局对话
        role=role,
        content=content,
        sources=sources or [],
        follow_up_questions=follow_ups or [],
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg.id


# ==================== SSE 工具函数 ====================

def _sse_event(event_type: str, **kwargs) -> str:
    """构造一条 SSE data 行"""
    payload = {"type": event_type, **kwargs}
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


# ==================== POST /api/chat ====================

@router.post("/api/chat")
async def chat(body: ChatRequest, db: Session = Depends(get_db)):
    """AI 对话（SSE 流式）— Phase 2 RAG 增强

    context_type 三种场景：
    - kb:     基于知识库 RAG 检索回答
    - doc:    基于指定文档 RAG 检索回答
    - global: 全局对话，不检索
    """
    kb = None
    doc = None
    kb_name = ""
    doc_name = ""
    doc_page = body.page or 0

    # —— 校验 & 查 KB/Doc ——
    if body.context_type in ("doc", "kb"):
        if not body.kb_id:
            raise HTTPException(status_code=422, detail="doc/kb 场景必须提供 kb_id")
        kb = db.query(KnowledgeBase).filter(
            KnowledgeBase.id == body.kb_id
        ).first()
        if not kb:
            raise HTTPException(status_code=404, detail="知识库不存在")
        kb_name = kb.name

        if body.context_type == "doc" and body.doc_id:
            doc = db.query(Document).filter(
                Document.id == body.doc_id,
                Document.kb_id == body.kb_id,
            ).first()
            if doc:
                doc_name = doc.filename

    # —— RAG 检索 ——
    rag_service = get_rag_service()
    llm_service = get_llm_service()
    sources: list[dict] = []
    source_objs: list[ChatSource] = []

    if body.kb_id and body.context_type != "global":
        sources = rag_service.search_chunks(
            kb_id=body.kb_id,
            query=body.question,
            top_k=5,
            doc_id=body.doc_id if body.context_type == "doc" else None,
        )
        source_objs = [
            ChatSource(
                doc_name=s["doc_name"],
                doc_id=s["doc_id"],
                page=s["page_num"],
                chunk_text=s["chunk_text"],
                score=s["score"],
            )
            for s in sources
        ]

    # —— 记录用户消息（独立 session，避免请求 session 关闭问题） ——
    _add_message(db, body.kb_id, "user", body.question)

    # 读取历史用于 LLM 上下文（独立 session 读取，防止 SSE 期间 db 关闭）
    history_db = SessionLocal()
    try:
        history = _get_history(body.kb_id, history_db)
    finally:
        history_db.close()

    # —— SSE 流式 ——
    async def stream():
        stream_db = SessionLocal()
        try:
            # 1. 先发送 source 事件（检索来源）
            if source_objs:
                yield _sse_event("source",
                    sources=[s.model_dump() for s in source_objs])

            # 2. 流式输出 LLM token
            answer_parts = []
            async for chunk in llm_service.chat_stream_rag(
                question=body.question,
                sources=sources,
                scenario=body.context_type,  # type: ignore
                kb_name=kb_name,
                doc_name=doc_name,
                doc_page=doc_page,
                chat_history=history,
            ):
                answer_parts.append(chunk)
                yield _sse_event("token", content=chunk)

            # 3. 记录 assistant 消息
            full_answer = "".join(answer_parts)
            msg_id = _add_message(
                stream_db,
                body.kb_id,
                "assistant",
                full_answer,
                sources=[s.model_dump() for s in source_objs] if source_objs else [],
            )

            # 4. done 事件
            yield _sse_event("done", message_id=msg_id,
                             follow_up_questions=[])

        except Exception as e:
            yield _sse_event("error", content=str(e))
        finally:
            stream_db.close()

    return StreamingResponse(
        stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ==================== 对话历史 ====================

def _history_to_response(kb_id: str | None, db: Session) -> ChatHistoryResponse:
    history = _get_history(kb_id, db)
    return ChatHistoryResponse(
        kb_id=kb_id,
        messages=[
            ChatMessageResponse(
                id=m["id"],
                role=m["role"],  # type: ignore
                content=m["content"],
                sources=[ChatSource(**s) for s in m.get("sources", [])] or None,
                follow_up_questions=m.get("follow_up_questions") or None,
                created_at=m.get("created_at"),  # type: ignore
            )
            for m in history
        ],
    )


@router.get("/api/kbs/{kb_id}/chat/history", response_model=ChatHistoryResponse)
def get_kb_chat_history(kb_id: str, db: Session = Depends(get_db)):
    """获取知识库对话历史"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    return _history_to_response(kb_id, db)


@router.get("/api/chat/history", response_model=ChatHistoryResponse)
def get_global_chat_history(db: Session = Depends(get_db)):
    """获取全局对话历史"""
    return _history_to_response(None, db)


@router.delete("/api/kbs/{kb_id}/chat/history", response_model=SuccessResponse)
def clear_kb_chat_history(kb_id: str, db: Session = Depends(get_db)):
    """清除知识库对话历史"""
    kb = db.query(KnowledgeBase).filter(KnowledgeBase.id == kb_id).first()
    if not kb:
        raise HTTPException(status_code=404, detail="知识库不存在")
    # 删除 ChatMessage 表中该 KB 的记录
    db.query(ChatMessage).filter(ChatMessage.kb_id == kb_id).delete()
    db.commit()
    return SuccessResponse(success=True)
