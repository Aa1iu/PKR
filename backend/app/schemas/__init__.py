"""Pydantic 请求/响应 Schema

API 契约定稿 — Phase 0 (2026-07-20)
端点总数：23 个
"""

from datetime import datetime
from typing import Optional, Literal

from pydantic import BaseModel, Field


# ==================== 工具函数 ====================

def tags_to_list(tags_str: str | None) -> list[str]:
    """ORM 逗号分隔字符串 → JSON 数组"""
    if not tags_str:
        return []
    return [t.strip() for t in tags_str.split(",") if t.strip()]


def tags_to_str(tags_list: list[str] | None) -> str:
    """JSON 数组 → ORM 逗号分隔字符串"""
    if not tags_list:
        return ""
    return ",".join(t.strip() for t in tags_list if t.strip())


# ==================== 通用 ====================

class SuccessResponse(BaseModel):
    success: bool


class ErrorResponse(BaseModel):
    detail: str


# ==================== 知识库 ====================

class KBCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, description="知识库名称")
    description: str = Field(default="", max_length=500)
    tags: list[str] = Field(default_factory=list, description="标签列表，每个标签不超过30字符")


class KBUpdate(BaseModel):
    """更新知识库 — 全部字段可选，仅更新传入的字段"""
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = Field(default=None, max_length=500)
    tags: Optional[list[str]] = Field(default=None)


class KBResponse(BaseModel):
    id: str
    name: str
    description: str
    tags: list[str]
    doc_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class KBListResponse(BaseModel):
    kbs: list[KBResponse]


class KBExportResponse(BaseModel):
    """知识库导出 — Phase 3 完整实现（Phase 0 占位）"""
    kb: KBResponse
    concepts: list["ConceptResponse"] = []
    relations: list["RelationResponse"] = []
    documents: list["DocResponse"] = []


# ==================== 文档 ====================

class DocResponse(BaseModel):
    doc_id: str
    filename: str
    type: str
    pages: int
    size: int
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class DocListResponse(BaseModel):
    docs: list[DocResponse]


class DocDetailResponse(BaseModel):
    """文档详情 — Phase 1 增强（Phase 0 与 DocResponse 字段一致）"""
    doc_id: str
    filename: str
    type: str
    pages: int
    size: int
    status: str
    created_at: datetime
    concept_refs: list["ConceptDocRefItem"] = []   # Phase 3
    chunk_count: int = 0                            # Phase 1


class DocRenameRequest(BaseModel):
    filename: str = Field(..., min_length=1, max_length=255, description="新文件名")


class DocPageResponse(BaseModel):
    page_num: int
    text: str


class DocContentResponse(BaseModel):
    pages: list[DocPageResponse]
    total_pages: int


class PageImageResponse(BaseModel):
    """文档页图片 — Phase 3 完整实现（Phase 0 占位）
    实际路由返回 FileResponse(image/png)，非 JSON。此 Schema 仅用于 Swagger 文档说明。
    """
    page_num: int
    image_url: str
    total_pages: int


# 全文搜索 — Phase 1 完整实现（Phase 0 占位）
class FullTextSearchResult(BaseModel):
    doc_id: str
    doc_name: str
    page_num: int
    snippet: str  # 匹配关键字周围上下文


class FullTextSearchResponse(BaseModel):
    results: list[FullTextSearchResult]


# ==================== 图谱 ====================

class GraphNode(BaseModel):
    id: str
    name: str
    definition: str
    type: str  # 基础概念 | 技术方法 | 工具框架 | 应用场景 | 其他
    degree: int  # 关联边数
    doc_refs: list[str]  # 来源文档 ID


class GraphEdge(BaseModel):
    source: str
    target: str
    relation: str  # 前置依赖 | 概念延伸 | 对比关系 | 包含关系 | 应用关系
    description: str


class GraphResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


# 概念模型 — Phase 3 完整实现（Phase 0 占位）
class ConceptResponse(BaseModel):
    id: str
    name: str
    definition: str
    concept_type: str  # 基础概念 | 技术方法 | 工具框架 | 应用场景 | 其他
    kb_id: str
    degree: int = 0
    doc_refs: list[str] = []
    created_at: datetime | None = None


class RelationResponse(BaseModel):
    id: str
    source_id: str
    target_id: str
    relation_type: str  # 前置依赖 | 概念延伸 | 对比关系 | 包含关系 | 应用关系
    description: str
    kb_id: str
    created_at: datetime | None = None


class ConceptDocRefItem(BaseModel):
    """概念-文档关联项 — Phase 3"""
    doc_id: str
    doc_name: str
    page_num: int
    paragraph: int


class ConceptPosition(BaseModel):
    """概念在文档中的出现位置 — Phase 3"""
    doc_id: str
    doc_name: str
    page_num: int
    paragraph: int


class ConceptPositionResponse(BaseModel):
    """概念位置映射响应 — Phase 3"""
    concept_id: str
    concept_name: str
    positions: list[ConceptPosition] = []


class AnalyzeRequest(BaseModel):
    """触发图谱分析 — Phase 3"""
    doc_ids: list[str] | None = None  # None=分析全部
    incremental: bool = True


class AnalyzeStatusResponse(BaseModel):
    """分析任务状态 — Phase 3"""
    kb_id: str
    status: str = "idle"  # idle | running | completed | failed
    progress: float = 0.0  # 0.0 ~ 1.0
    current_step: str = ""
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error: str | None = None


# ==================== 对话 ====================

class ChatSource(BaseModel):
    """回答引用的文档来源 — Phase 2"""
    doc_name: str
    doc_id: str
    page: int
    chunk_text: str
    score: float


class ChatRequest(BaseModel):
    question: str = Field(..., min_length=1)
    context_type: Literal["doc", "kb", "global"] = "kb"
    kb_id: Optional[str] = Field(default=None, description="doc/kb 场景必填，global 场景不传")
    doc_id: Optional[str] = Field(default=None, description="doc 场景必填")
    page: Optional[int] = Field(default=None, description="当前文档页码")


class ChatMessageResponse(BaseModel):
    """单条对话消息 — Phase 2 完整实现（Phase 0 占位）"""
    id: str
    role: Literal["user", "assistant"]
    content: str
    sources: list[ChatSource] | None = None
    follow_up_questions: list[str] | None = None
    created_at: datetime | None = None


class ChatHistoryResponse(BaseModel):
    """对话历史响应 — Phase 2 完整实现（Phase 0 占位）"""
    kb_id: str | None = None  # None 表示全局对话
    messages: list[ChatMessageResponse] = []


# ==================== 检索 ====================

class SearchRequest(BaseModel):
    kb_id: str
    query: str = Field(..., min_length=1)
    top_k: int = Field(default=5, ge=1, le=20, description="返回结果数量")


class SearchResult(BaseModel):
    chunk_text: str
    doc_name: str
    page: int
    score: float


class SearchResponse(BaseModel):
    results: list[SearchResult]


class ReindexResponse(BaseModel):
    """重建向量索引响应 — Phase 2"""
    kb_id: str
    total_chunks: int = 0
    status: str = "completed"  # completed | failed
    error: str | None = None


# ==================== 前向引用更新 ====================

KBExportResponse.model_rebuild()
DocDetailResponse.model_rebuild()
