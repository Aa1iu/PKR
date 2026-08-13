import { useRef, useEffect, useState } from 'react';
import { Button, Input, Typography } from 'antd';
import { SendOutlined, RobotOutlined, FileTextOutlined } from '@ant-design/icons';
import { useChatStore } from '../stores/chatStore';
import { useChatStream } from '../hooks/useChatStream';
import MarkdownRenderer from './MarkdownRenderer';
import SourceCitation from './SourceCitation';

const { Text } = Typography;

/** 消息内容最大宽度（DeepSeek 风格居中） */
const MAX_WIDTH = 768;

/** 示例问题（空状态可点击） */
const SUGGESTIONS = [
  { icon: <FileTextOutlined />, text: '这个知识库里有哪些文档？' },
  { icon: <FileTextOutlined />, text: '帮我总结一下文档的核心内容' },
  { icon: <FileTextOutlined />, text: '这些知识之间存在什么关联？' },
];

/**
 * AI 对话面板 — DeepSeek 风格
 *
 * 布局：
 *  - 消息区最大宽度 768px 居中
 *  - 空状态：大标题 + 示例问题卡片
 *  - 用户消息：右对齐圆角块；AI 消息：左侧图标 + Markdown
 *  - 底部大圆角输入框 + 圆形发送按钮
 */
function ChatPanel({ kbId }: { kbId?: string | null }) {
  const messages = useChatStore((s) => s.messages);
  const inputValue = useChatStore((s) => s.inputValue);
  const sending = useChatStore((s) => s.sending);
  const setInputValue = useChatStore((s) => s.setInputValue);
  const handleStream = useChatStream(kbId);

  const msgListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // 用户消息 ref（定位条跳转用）
  const userMsgRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  // 闪烁中的提问索引（点击定位后闪烁提示）
  const [flashIdx, setFlashIdx] = useState<number | null>(null);
  // tooltip 视口坐标（fixed 定位，避免被滚动容器截断）
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  // 用户提问列表（定位条数据源）
  const userQuestions = messages.filter((m) => m.role === 'user');

  // 新消息到达时自动滚到底部
  useEffect(() => {
    if (msgListRef.current) {
      msgListRef.current.scrollTop = msgListRef.current.scrollHeight;
    }
  }, [messages]);

  /** 滚动监听：计算当前可见的提问索引 */
  const handleScroll = () => {
    const container = msgListRef.current;
    if (!container) return;
    const containerTop = container.getBoundingClientRect().top;
    let current = -1;
    userMsgRefs.current.forEach((el, i) => {
      if (el && el.getBoundingClientRect().top <= containerTop + 100) {
        current = i;
      }
    });
    setActiveIdx(current);
  };

  /** 点击定位点 → 平滑滚动到对应提问 + 闪烁提示 */
  const scrollToQuestion = (idx: number) => {
    const el = userMsgRefs.current[idx];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    // 闪烁当前提问词条（1.5s 后清除）
    setFlashIdx(idx);
    setTimeout(() => setFlashIdx(null), 1500);
  };

  /** 发送消息 */
  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || sending) return;
    setInputValue('');
    handleStream(text);
    // 输入框失去焦点后重新聚焦（移动端体验）
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  /** Enter 发送，Shift+Enter 换行 */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = inputValue.trim().length > 0 && !sending;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* ===== 消息区外层 wrapper（定位条锚点，不滚动 → 定位条固定） ===== */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, display: 'flex' }}>
      {/* ===== 消息列表区（独立滚动容器） ===== */}
      <div
        ref={msgListRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          overscrollBehavior: 'contain',
          padding: '24px 16px',
        }}
      >
        <div style={{ maxWidth: MAX_WIDTH, margin: '0 auto' }}>
          {/* ===== 空状态：DeepSeek 风格 ===== */}
          {messages.length === 0 && (
            <div style={{ paddingTop: '12vh', textAlign: 'center' }}>
              <div style={{ marginBottom: 8 }}>
                <RobotOutlined style={{ fontSize: 48, color: 'var(--color-primary)' }} />
              </div>
              <Typography.Title level={2} style={{ margin: '8px 0 4px' }}>
                今天做些什么呢？
              </Typography.Title>
              <Text type="secondary" style={{ fontSize: 14 }}>
                基于你的知识库提问，或先上传文档再开始对话
              </Text>

              {/* 示例问题卡片 */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  maxWidth: 480,
                  margin: '28px auto 0',
                }}
              >
                {SUGGESTIONS.map((s) => (
                  <div
                    key={s.text}
                    onClick={() => {
                      setInputValue(s.text);
                      setTimeout(() => handleSend(), 50);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '12px 16px',
                      borderRadius: 12,
                      background: 'var(--color-surface)',
                      border: '1px solid var(--color-border)',
                      cursor: 'pointer',
                      color: 'var(--color-text)',
                      fontSize: 14,
                      transition: 'border-color 0.2s, transform 0.2s',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-primary)';
                      (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)';
                      (e.currentTarget as HTMLDivElement).style.transform = 'none';
                    }}
                  >
                    <span style={{ color: 'var(--color-primary)' }}>{s.icon}</span>
                    {s.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== 消息列表（DeepSeek 风格） ===== */}
          {messages.map((msg, msgIdx) => {
            const isUser = msg.role === 'user';
            // 用户消息在提问列表中的索引（定位条用）
            const qIdx = isUser
              ? messages.slice(0, msgIdx).filter((m) => m.role === 'user').length
              : -1;
            return (
              <div
                key={msg.id}
                ref={isUser ? (el) => { userMsgRefs.current[qIdx] = el; } : undefined}
                style={{
                  display: 'flex',
                  marginBottom: 28,
                  gap: 12,
                  justifyContent: isUser ? 'flex-end' : 'flex-start',
                  scrollMarginTop: 20,
                }}
              >
                {/* AI 图标（仅 AI 消息显示） */}
                {!isUser && (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 8,
                      background: 'var(--color-primary-bg)',
                      color: 'var(--color-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  >
                    <RobotOutlined />
                  </div>
                )}

                {/* 消息内容 */}
                <div
                  style={{
                    maxWidth: isUser ? '60%' : 'calc(100% - 44px)',
                  }}
                >
                  {isUser ? (
                    <div
                      style={{
                        padding: '10px 16px',
                        borderRadius: 16,
                        borderTopRightRadius: 4,
                        background: 'var(--color-primary)',
                        color: '#fff',
                        fontSize: 14,
                        lineHeight: 1.7,
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        // 点击定位后闪烁提示
                        animation: flashIdx === qIdx ? 'pkr-flash 1.5s ease-out' : undefined,
                      }}
                    >
                      {msg.content}
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 14, lineHeight: 1.8, wordBreak: 'break-word' }}>
                        <MarkdownRenderer content={msg.content} />
                      </div>
                      <SourceCitation sources={msg.sources} />
                      {/* 推荐追问 */}
                      {msg.follow_up_questions && msg.follow_up_questions.length > 0 && (
                        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {msg.follow_up_questions.map((q, qi) => (
                            <div
                              key={qi}
                              onClick={() => {
                                setInputValue(q);
                                setTimeout(() => handleSend(), 50);
                              }}
                              style={{
                                alignSelf: 'flex-start',
                                padding: '6px 14px',
                                borderRadius: 16,
                                border: '1px solid var(--color-border)',
                                background: 'var(--color-surface)',
                                color: 'var(--color-text)',
                                fontSize: 13,
                                cursor: 'pointer',
                                transition: 'border-color 0.2s',
                                maxWidth: '100%',
                              }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-primary)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--color-border)'; }}
                            >
                              {q}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* ===== 发送中指示 ===== */}
          {sending && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: 'var(--color-primary-bg)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 4,
                }}
              >
                <RobotOutlined />
              </div>
              <div
                style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: 14,
                  paddingTop: 8,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    gap: 4,
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                      animation: 'pkr-blink 1.2s infinite',
                    }}
                  />
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                      animation: 'pkr-blink 1.2s infinite 0.2s',
                    }}
                  />
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: 'var(--color-primary)',
                      animation: 'pkr-blink 1.2s infinite 0.4s',
                    }}
                  />
                </span>
              </div>
            </div>
          )}
        </div>

      </div>

      {/* ===== 右侧快速定位条（≥2 轮提问时显示；位于 wrapper 层，不随滚动移动） ===== */}
      {userQuestions.length >= 2 && (
        <div
          style={{
            position: 'absolute',
            right: 28, // 避开滚动条（滚动条约 10px + 间距）
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '8px 0',
            zIndex: 10,
          }}
        >
          {userQuestions.map((q, i) => {
            const isActive = i === activeIdx;
            const isHover = hoverIdx === i;
            return (
              <div
                key={q.id}
                style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                onMouseEnter={(e) => {
                  setHoverIdx(i);
                  // 记录圆点左边缘视口坐标（tooltip 在左侧弹出）
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  setTooltipPos({ x: rect.left - 10, y: rect.top + rect.height / 2 });
                }}
                onMouseLeave={() => {
                  setHoverIdx(null);
                  setTooltipPos(null);
                }}
              >
                {/* 圆点 */}
                <div
                  onClick={() => scrollToQuestion(i)}
                  style={{
                    width: isActive ? 10 : 7,
                    height: isActive ? 10 : 7,
                    borderRadius: '50%',
                    background: isActive ? 'var(--color-primary)' : 'var(--color-border)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    alignSelf: 'center',
                  }}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* ===== tooltip（fixed 视口定位，显示问题全文，不被容器截断） ===== */}
      {tooltipPos && hoverIdx !== null && userQuestions[hoverIdx] && (
        <div
          style={{
            position: 'fixed',
            left: tooltipPos.x,
            top: tooltipPos.y,
            // 向左展开：右边缘贴圆点左边缘
            transform: 'translate(-100%, -50%)',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 12,
            color: 'var(--color-text)',
            whiteSpace: 'nowrap',
            maxWidth: 300,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          {userQuestions[hoverIdx].content}
        </div>
      )}
      </div>

      {/* ===== 底部输入区（DeepSeek 风格） ===== */}
      <div
        style={{
          padding: '8px 16px 16px',
          flexShrink: 0,
        }}
      >
        <div style={{ maxWidth: MAX_WIDTH, margin: '0 auto' }}>
          {/* 大圆角输入框容器 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 8,
              padding: '10px 12px 10px 20px',
              borderRadius: 24,
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              transition: 'border-color 0.2s, box-shadow 0.2s',
            }}
            onFocusCapture={() => {
              // 聚焦时边框高亮（通过 CSS 无法直接监听，这里简化处理）
            }}
          >
            <Input.TextArea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入问题，Enter 发送 / Shift+Enter 换行"
              autoSize={{ minRows: 1, maxRows: 8 }}
              disabled={sending}
              variant="borderless"
              style={{
                flex: 1,
                fontSize: 15,
                padding: 0,
                resize: 'none',
                background: 'transparent',
                color: 'var(--color-text)',
              }}
            />
            {/* 圆形发送按钮（在输入框内部右侧） */}
            <Button
              type="primary"
              shape="circle"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={sending}
              disabled={!canSend}
              style={{
                width: 36,
                height: 36,
                flexShrink: 0,
                opacity: canSend ? 1 : 0.4,
              }}
            />
          </div>

          {/* 底部提示 */}
          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              AI 可能会出错，请核查重要信息
            </Text>
          </div>
        </div>
      </div>

      {/* 打字指示动画 keyframes（全局唯一，避免重复定义冲突） */}
      <style>{`
        @keyframes pkr-blink {
          0%, 80%, 100% { opacity: 0.2; }
          40% { opacity: 1; }
        }
        @keyframes pkr-flash {
          0% { box-shadow: 0 0 0 0 rgba(64, 150, 255, 0.7); background: var(--color-primary); }
          30% { box-shadow: 0 0 0 8px rgba(64, 150, 255, 0); background: var(--color-primary); }
          60% { box-shadow: 0 0 0 6px rgba(64, 150, 255, 0.4); background: var(--color-primary); }
          100% { box-shadow: 0 0 0 0 rgba(64, 150, 255, 0); background: var(--color-primary); }
        }
      `}</style>
    </div>
  );
}

export default ChatPanel;
