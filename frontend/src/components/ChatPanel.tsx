import { useRef, useEffect } from 'react';
import { Button, Input, Typography } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useChatStore } from '../stores/chatStore';
import { useChatStream } from '../hooks/useChatStream';
import MarkdownRenderer from './MarkdownRenderer';
import SourceCitation from './SourceCitation';

const { Text } = Typography;

/**
 * AI 对话面板 — 消息列表 + 底部输入栏
 *
 * 与 FloatChat 共享 useChatStore，同一份对话状态。
 * Phase 2 接入真实 SSE 流式 API 时替换 mock setTimeout。
 */
function ChatPanel() {
  const messages = useChatStore((s) => s.messages);
  const inputValue = useChatStore((s) => s.inputValue);
  const sending = useChatStore((s) => s.sending);
  const setInputValue = useChatStore((s) => s.setInputValue);
  const handleStream = useChatStream();

  const msgListRef = useRef<HTMLDivElement>(null);

  // 新消息到达时自动滚到底部
  useEffect(() => {
    if (msgListRef.current) {
      msgListRef.current.scrollTop = msgListRef.current.scrollHeight;
    }
  }, [messages]);

  /** 发送消息 */
  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || sending) return;
    setInputValue('');
    handleStream(text);
  };

  /** Enter 发送，Shift+Enter 换行 */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* ===== 消息列表区 — 占满剩余空间 ===== */}
      <div
        ref={msgListRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        {/* 空状态引导 */}
        {messages.length === 0 && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text type="secondary" style={{ fontSize: 14 }}>
              今天做些什么呢
            </Text>
          </div>
        )}

        {/* 消息气泡 */}
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: isUser ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: isUser ? '70%' : '85%',
                  padding: '10px 16px',
                  borderRadius: 12,
                  borderTopRightRadius: isUser ? 4 : 12,
                  borderTopLeftRadius: isUser ? 12 : 4,
                  background: isUser ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: isUser ? '#fff' : 'var(--color-text)',
                  fontSize: 14,
                  lineHeight: 1.6,
                  wordBreak: 'break-word',
                }}
              >
                {isUser ? msg.content : (
                  <>
                    <MarkdownRenderer content={msg.content} />
                    <SourceCitation sources={msg.sources} />
                  </>
                )}
              </div>
            </div>
          );
        })}

        {/* 发送中 loading 指示器 */}
        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              style={{
                padding: '10px 16px',
                borderRadius: 12,
                borderTopLeftRadius: 4,
                background: 'var(--color-surface)',
                color: 'var(--color-text-secondary)',
                fontSize: 14,
              }}
            >
              AI 思考中...
            </div>
          </div>
        )}
      </div>

      {/* ===== 底部输入栏 ===== */}
      <div
        style={{
          padding: '12px 0 20px',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <Input.TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入问题，Enter 发送 / Shift+Enter 换行"
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={sending}
            style={{ flex: 1 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            loading={sending}
            disabled={!inputValue.trim()}
          />
        </div>
      </div>
    </>
  );
}

export default ChatPanel;
