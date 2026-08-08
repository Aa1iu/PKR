/** 知识库 */
export interface KB {
  id: string;
  name: string;
  description: string;
  tags: string[];
  doc_count: number;
  created_at: string;
}

/** 文档 */
export interface Doc {
  doc_id: string;
  filename: string;
  type: 'pdf' | 'pptx' | 'docx' | 'md' | 'txt';
  pages: number;
  size: string;
  status: 'processing' | 'analyzed' | 'failed';
  created_at: string;
}

/** 图谱节点 */
export interface GraphNode {
  id: string;
  name: string;
  definition: string;
  type: '基础概念' | '技术方法' | '工具框架' | '应用场景' | '其他';
  degree: number;
  doc_refs: { doc_id: string; filename: string; page: number }[];
}

/** 图谱边 */
export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  description: string;
}

/** 对话消息 */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: { doc_name: string; doc_id: string; page: number; chunk_text: string; score: number }[];
  follow_up_questions?: string[];
  created_at: string;
}

/** 对话会话 */
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  created_at: string;
  updated_at: string;
}

/** SSE 流式对话事件（CLAUDE.md API 契约 § 对话） */
export interface ChatEvent {
  type: 'token' | 'source' | 'done' | 'error';
  content?: string;
  message_id?: string;
  sources?: { doc_name: string; doc_id: string; page: number; chunk_text: string; score: number }[];
  follow_up_questions?: string[];
}
