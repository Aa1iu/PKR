/**
 * AI 对话 API — SSE 流式请求
 *
 * Phase 2：使用 fetch + ReadableStream 解析 SSE（支持 POST 传参）。
 * 后端返回 SSE 格式：
 *   data: {"type":"token",   "content":"..."}
 *   data: {"type":"source",  "sources":[...]}
 *   data: {"type":"done",    "message_id":"...", "follow_up_questions":["..."]}
 *   data: {"type":"error",   "content":"错误描述"}
 */

import type { ChatEvent } from '../types';

export interface ChatRequest {
  question: string;
  context_type: 'doc' | 'kb' | 'global';
  kb_id?: string;
  doc_id?: string;
  page?: number;
}

/**
 * SSE 流式对话 — 返回 AsyncGenerator，逐条产出 ChatEvent
 *
 * 使用方式：
 *   for await (const event of streamChat({ question: '...', context_type: 'kb', kb_id: '...' })) {
 *     if (event.type === 'token') onToken(event.content);
 *     if (event.type === 'done')  onDone(event.message_id);
 *   }
 */
export async function* streamChat(req: ChatRequest): AsyncGenerator<ChatEvent> {
  let res: Response;

  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  } catch {
    yield { type: 'error', content: '网络请求失败，请检查后端是否已启动' };
    return;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    yield { type: 'error', content: body.detail || `请求失败 (${res.status})` };
    return;
  }

  if (!res.body) {
    yield { type: 'error', content: '响应体为空' };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE 事件以 \n\n 分隔
      const parts = buffer.split('\n\n');
      // 最后一个可能不完整，留到下次
      buffer = parts.pop() || '';

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        // 解析 "data: {...}" 行
        for (const line of trimmed.split('\n')) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const event: ChatEvent = JSON.parse(jsonStr);
              yield event;

              // done 或 error 后停止读取
              if (event.type === 'done' || event.type === 'error') {
                reader.cancel();
                return;
              }
            } catch {
              // 跳过无法解析的行
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

