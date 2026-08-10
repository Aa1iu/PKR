import { useCallback } from 'react';
import { message } from 'antd';
import { useChatStore } from '../stores/chatStore';
import { streamChat } from '../api/chat';

/**
 * 流式对话发送 hook — ChatPanel 与 FloatChat 共享
 *
 * @param kbId  知识库 ID（可选）。有则基于 KB 上下文回答，无则全局对话。
 *
 * 调用 handleSend(question) 即启动一次流式对话：
 *   1. 创建 userMsg + 空 assistant 占位消息
 *   2. 逐 token 追加到 assistant 消息
 *   3. done 后写入 sources + follow_up_questions
 */
export function useChatStream(kbId?: string | null) {
  const addMessage = useChatStore((s) => s.addMessage);
  const appendToken = useChatStore((s) => s.appendToken);
  const finishMessage = useChatStore((s) => s.finishMessage);
  const setSending = useChatStore((s) => s.setSending);
  const ensureConversation = useChatStore((s) => s.ensureConversation);
  const autoTitleConversation = useChatStore((s) => s.autoTitleConversation);

  const handleSend = useCallback(
    async (question: string) => {
      setSending(true);

      // 确保存在活跃会话（无则自动创建）
      ensureConversation();
      // 自动用首条用户消息命名会话
      const title = question.trim().length > 30
        ? question.trim().slice(0, 30) + '...'
        : question.trim();
      autoTitleConversation(title);

      // 1. 用户消息
      const userMsgId = `msg_${Date.now()}`;
      addMessage({
        id: userMsgId,
        role: 'user',
        content: question,
        created_at: new Date().toISOString(),
      });

      // 2. AI 占位消息
      const aiMsgId = `msg_${Date.now() + 1}`;
      addMessage({
        id: aiMsgId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString(),
      });

      // 3. 流式接收（真实 SSE API）
      const req = kbId
        ? { question, context_type: 'kb' as const, kb_id: kbId }
        : { question, context_type: 'global' as const };

      try {
        for await (const event of streamChat(req)) {
          switch (event.type) {
            case 'token':
              appendToken(aiMsgId, event.content!);
              break;

            case 'source':
              // 中途收到 source 事件时更新 sources
              finishMessage(aiMsgId, event.sources);
              break;

            case 'done':
              finishMessage(
                aiMsgId,
                event.sources,
                event.follow_up_questions,
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
    [kbId, addMessage, appendToken, finishMessage, setSending, ensureConversation, autoTitleConversation],
  );

  return handleSend;
}
