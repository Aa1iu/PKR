import { useCallback, useState } from 'react';
import { message } from 'antd';
import { streamChat } from '../api/chat';
import type { ChatMessage } from '../types';

/**
 * 独立流式对话 hook（FloatChat 浮动窗口专用）
 *
 * 与 useChatStream 逻辑一致，但消息存储在组件本地 state，
 * 不依赖全局 chatStore —— 避免与主面板（ChatPanel）互相干扰。
 *
 * @param kbId 知识库 ID（可选）。有则基于 KB 上下文回答，无则全局对话。
 */
export function useLocalChatStream(kbId?: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sending, setSending] = useState(false);

  const send = useCallback(
    async (question: string) => {
      if (!question.trim() || sending) return;
      setSending(true);

      // 1. 用户消息
      const userMsgId = `msg_${Date.now()}`;
      const userMsg: ChatMessage = {
        id: userMsgId,
        role: 'user',
        content: question,
        created_at: new Date().toISOString(),
      };

      // 2. AI 占位消息
      const aiMsgId = `msg_${Date.now() + 1}`;
      const aiMsg: ChatMessage = {
        id: aiMsgId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMsg, aiMsg]);

      // 3. 流式接收
      const req = kbId
        ? { question, context_type: 'kb' as const, kb_id: kbId }
        : { question, context_type: 'global' as const };

      try {
        for await (const event of streamChat(req)) {
          switch (event.type) {
            case 'token':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId
                    ? { ...m, content: m.content + (event.content || '') }
                    : m,
                ),
              );
              break;

            case 'source':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId ? { ...m, sources: event.sources } : m,
                ),
              );
              break;

            case 'done':
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === aiMsgId
                    ? { ...m, follow_up_questions: event.follow_up_questions }
                    : m,
                ),
              );
              setSending(false);
              break;

            case 'error':
              message.error(event.content || '对话请求失败');
              setSending(false);
              break;
          }
        }
      } catch {
        message.error('对话连接异常，请确认后端已启动');
        setSending(false);
      }
    },
    [kbId, sending],
  );

  return { messages, sending, send };
}
