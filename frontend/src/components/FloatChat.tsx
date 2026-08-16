import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Button, Input, Typography } from 'antd';
import { MessageOutlined, CloseOutlined, MinusOutlined, SendOutlined } from '@ant-design/icons';
import { useKBStore } from '../stores/kbStore';
import { useLocalChatStream } from '../hooks/useLocalChatStream';
import MarkdownRenderer from './MarkdownRenderer';
import SourceCitation from './SourceCitation';

const { Text } = Typography;

/** 浮动窗口默认尺寸 */
const WIN_W = 420;
const WIN_H = 560;
/** 触发按钮尺寸 */
const BTN_SIZE = 52;

/**
 * AI 浮动对话窗口
 *
 * - 右下角悬浮按钮，点击展开对话窗口
 * - 可拖拽标题栏移动位置
 * - AI 回复（SSE 流式）
 * - 通过 Portal 渲染到 document.body，全局可用
 */
function FloatChat() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);

  // 独立对话状态（不与主面板共享，避免互相干扰）
  const currentKbId = useKBStore((s) => s.currentKbId);
  const { messages, sending, send } = useLocalChatStream(currentKbId);
  const [inputValue, setInputValue] = useState('');

  // ---- 窗口位置 ----
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - WIN_W - 24,
    y: window.innerHeight - WIN_H - BTN_SIZE - 32,
  }));

  const msgListRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  // ---- 新消息自动滚底 ----
  useEffect(() => {
    if (msgListRef.current) {
      msgListRef.current.scrollTop = msgListRef.current.scrollHeight;
    }
  }, [messages]);

  // ---- 拖拽标题栏 ----
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: pos.x, startPosY: pos.y };
      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        setPos({
          x: dragRef.current.startPosX + (ev.clientX - dragRef.current.startX),
          y: dragRef.current.startPosY + (ev.clientY - dragRef.current.startY),
        });
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [pos],
  );

  // ---- 发送消息（本地独立对话） ----
  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || sending) return;
    setInputValue('');
    send(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ---- 窗口关闭时不清空消息 ----
  const handleClose = () => {
    setOpen(false);
    setMinimized(false);
  };

  const handleToggle = () => {
    if (!open) {
      setOpen(true);
      setMinimized(false);
    } else if (minimized) {
      setMinimized(false);
    } else {
      setMinimized(true);
    }
  };

  return (
    <>
      {/* ===== 悬浮触发按钮 ===== */}
      {createPortal(
        <button
          onClick={handleToggle}
          title="AI 对话"
          style={{
            position: 'fixed',
            right: 24,
            bottom: 24,
            width: BTN_SIZE,
            height: BTN_SIZE,
            borderRadius: '50%',
            background: 'var(--color-primary)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 22,
            boxShadow: '0 4px 14px var(--color-primary-shadow)',
            zIndex: 1000,
            transition: 'transform .15s',
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.transform = 'scale(1.08)'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
        >
          {open && !minimized ? <MinusOutlined /> : <MessageOutlined />}
        </button>,
        document.body,
      )}

      {/* ===== 浮动对话窗口（最小化时完全隐藏，只留 FAB） ===== */}
      {open && !minimized &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: pos.x,
              top: pos.y,
              width: WIN_W,
              height: WIN_H,
              background: 'var(--color-bg)',
              borderRadius: 12,
              boxShadow: '0 8px 40px var(--color-shadow)',
              zIndex: 999,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* --- 标题栏（可拖拽） --- */}
            <div
              onMouseDown={onMouseDown}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                background: 'var(--color-primary)',
                color: '#fff',
                cursor: 'move',
                userSelect: 'none',
                flexShrink: 0,
              }}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: 500 }}>AI 助手</Text>
              <div style={{ display: 'flex', gap: 4 }}>
                <Button
                  type="text"
                  size="small"
                  icon={<MinusOutlined />}
                  onClick={() => setMinimized(true)}
                  style={{ color: '#fff' }}
                />
                <Button
                  type="text"
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={handleClose}
                  style={{ color: '#fff' }}
                />
              </div>
            </div>

            {/* --- 对话内容区 --- */}
            <div
              ref={msgListRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {messages.length === 0 && (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    在下方输入问题，开始 AI 对话
                  </Text>
                </div>
              )}

              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={msg.id} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
                    <div
                      style={{
                        maxWidth: isUser ? '70%' : '85%',
                        padding: '8px 14px',
                        borderRadius: 10,
                        borderTopRightRadius: isUser ? 4 : 10,
                        borderTopLeftRadius: isUser ? 10 : 4,
                        background: isUser ? 'var(--color-primary)' : 'var(--color-surface)',
                        color: isUser ? '#fff' : 'var(--color-text)',
                        fontSize: 13,
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

              {sending && (
                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                  <div style={{ padding: '8px 14px', borderRadius: 10, background: 'var(--color-surface)', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                    AI 思考中...
                  </div>
                </div>
              )}
            </div>

            {/* --- 底部输入栏 --- */}
            <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--color-border)', flexShrink: 0 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
                <Input.TextArea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="输入问题，Enter 发送"
                  autoSize={{ minRows: 1, maxRows: 3 }}
                  disabled={sending}
                  style={{ flex: 1, fontSize: 13 }}
                />
                <Button
                  type="primary"
                  size="small"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  loading={sending}
                  disabled={!inputValue.trim()}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export default FloatChat;
