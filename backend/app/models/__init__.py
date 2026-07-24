"""数据库 ORM 模型"""

import uuid
from datetime import datetime

from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, JSON
from sqlalchemy.orm import relationship

from ..core.database import Base


def gen_uuid():
    return uuid.uuid4().hex[:16]


class KnowledgeBase(Base):
    __tablename__ = "knowledge_bases"

    id = Column(String(16), primary_key=True, default=gen_uuid)
    name = Column(String(100), nullable=False)
    description = Column(Text, default="")
    tags = Column(String(500), default="")  # 逗号分隔存储，API 层转换为 list[str]
    created_at = Column(DateTime, default=datetime.utcnow)

    documents = relationship("Document", back_populates="kb", cascade="all, delete-orphan")
    concepts = relationship("Concept", back_populates="kb", cascade="all, delete-orphan")
    relations = relationship("Relation", back_populates="kb", cascade="all, delete-orphan")
    chat_messages = relationship("ChatMessage", back_populates="kb", cascade="all, delete-orphan")


class Document(Base):
    __tablename__ = "documents"

    id = Column(String(16), primary_key=True, default=gen_uuid)
    kb_id = Column(String(16), ForeignKey("knowledge_bases.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(10), nullable=False)  # pdf, docx, pptx, txt, md
    file_path = Column(String(500), nullable=False)  # 服务端存储路径
    file_size = Column(Integer, default=0)  # 字节
    total_pages = Column(Integer, default=0)
    status = Column(String(20), default="processing")  # processing, ready, error
    created_at = Column(DateTime, default=datetime.utcnow)

    kb = relationship("KnowledgeBase", back_populates="documents")
    pages = relationship("DocumentPage", back_populates="document", cascade="all, delete-orphan")
    concept_refs = relationship("ConceptDocRef", back_populates="document", cascade="all, delete-orphan")


class DocumentPage(Base):
    __tablename__ = "document_pages"

    id = Column(String(16), primary_key=True, default=gen_uuid)
    doc_id = Column(String(16), ForeignKey("documents.id"), nullable=False)
    page_num = Column(Integer, nullable=False)
    text = Column(Text, default="")

    document = relationship("Document", back_populates="pages")


# ==================== Phase 3 完整实现：知识图谱相关 ORM ====================

class Concept(Base):
    """概念节点 — Phase 3"""
    __tablename__ = "concepts"

    id = Column(String(16), primary_key=True, default=gen_uuid)
    kb_id = Column(String(16), ForeignKey("knowledge_bases.id"), nullable=False)
    name = Column(String(100), nullable=False)
    definition = Column(Text, default="")
    concept_type = Column(String(20), default="其他")  # 基础概念 | 技术方法 | 工具框架 | 应用场景 | 其他
    created_at = Column(DateTime, default=datetime.utcnow)

    kb = relationship("KnowledgeBase", back_populates="concepts")
    doc_refs = relationship("ConceptDocRef", back_populates="concept", cascade="all, delete-orphan")
    # 出入边关系
    relations_from = relationship(
        "Relation", foreign_keys="Relation.source_concept_id",
        back_populates="source_concept", cascade="all, delete-orphan",
    )
    relations_to = relationship(
        "Relation", foreign_keys="Relation.target_concept_id",
        back_populates="target_concept", cascade="all, delete-orphan",
    )


class ConceptDocRef(Base):
    """概念→文档引用位置 — Phase 3"""
    __tablename__ = "concept_doc_refs"

    id = Column(String(16), primary_key=True, default=gen_uuid)
    concept_id = Column(String(16), ForeignKey("concepts.id"), nullable=False)
    doc_id = Column(String(16), ForeignKey("documents.id"), nullable=False)
    page_num = Column(Integer, default=0)
    paragraph = Column(Integer, default=0)  # 段落号

    concept = relationship("Concept", back_populates="doc_refs")
    document = relationship("Document", back_populates="concept_refs")


class Relation(Base):
    """概念间关系 — Phase 3"""
    __tablename__ = "relations"

    id = Column(String(16), primary_key=True, default=gen_uuid)
    kb_id = Column(String(16), ForeignKey("knowledge_bases.id"), nullable=False)
    source_concept_id = Column(String(16), ForeignKey("concepts.id"), nullable=False)
    target_concept_id = Column(String(16), ForeignKey("concepts.id"), nullable=False)
    relation_type = Column(String(20), nullable=False)  # 前置依赖 | 概念延伸 | 对比关系 | 包含关系 | 应用关系
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    kb = relationship("KnowledgeBase", back_populates="relations")
    source_concept = relationship("Concept", foreign_keys=[source_concept_id], back_populates="relations_from")
    target_concept = relationship("Concept", foreign_keys=[target_concept_id], back_populates="relations_to")


# ==================== Phase 2 完整实现：对话消息 ORM ====================

class ChatMessage(Base):
    """对话消息 — Phase 2"""
    __tablename__ = "chat_messages"

    id = Column(String(16), primary_key=True, default=gen_uuid)
    kb_id = Column(String(16), ForeignKey("knowledge_bases.id"), nullable=True)  # NULL=全局对话
    role = Column(String(10), nullable=False)  # user | assistant
    content = Column(Text, nullable=False)
    sources = Column(JSON, default=list)  # [{"doc_name":"...","doc_id":"...","page":1,"chunk_text":"...","score":0.9}]
    follow_up_questions = Column(JSON, default=list)  # ["追问1", "追问2"]
    created_at = Column(DateTime, default=datetime.utcnow)

    kb = relationship("KnowledgeBase", back_populates="chat_messages")
