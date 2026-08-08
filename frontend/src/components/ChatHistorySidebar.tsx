import { useState } from 'react';
import { Button, Tooltip, List, Typography, Popconfirm, message } from 'antd';
import { HistoryOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useChatStore } from '../stores/chatStore';

const { Title, Text } = Typography;

/** 格式化日期：今天显示时间，否则显示月/日 */
function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

/**
 * 对话历史左侧边栏
 *
 * - 镜像右侧 Sidebar 的按钮条 + 展开面板模式
 * - 按钮条在左侧，面板在右侧（面板贴近主内容区）
 * - 支持新建/切换/删除会话
 * - 通过 chatStore 与 ChatPanel / FloatChat 共享数据
 */
function ChatHistorySidebar() {
  const [open, setOpen] = useState(false);

  const conversations = useChatStore((s) => s.conversations);
  const currentConversationId = useChatStore((s) => s.currentConversationId);
  const sending = useChatStore((s) => s.sending);
  const switchConversation = useChatStore((s) => s.switchConversation);
  const createConversation = useChatStore((s) => s.createConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);

  // ---- 切换会话 ----
  const handleSwitch = (id: string) => {
    if (id === currentConversationId) return;
    if (sending) {
      message.warning('请等待当前消息发送完成');
      return;
    }
    switchConversation(id);
    setOpen(false); // 切换后收起面板
  };

  // ---- 新建会话 ----
  const handleNew = () => {
    if (sending) {
      message.warning('请等待当前消息发送完成');
      return;
    }
    createConversation();
    setOpen(false);
  };

  // ---- 删除会话 ----
  const handleDelete = (id: string) => {
    if (sending) {
      message.warning('请等待当前消息发送完成');
      return;
    }
    deleteConversation(id);
  };

  return (
    <div style={{ display: 'flex', gap: 0 }}>
      {/* ===== 按钮条（左边缘，始终显示） ===== */}
      <div
        style={{
          width: 40,
          borderRight: open ? undefined : '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '10px 0',
          gap: 8,
        }}
      >
        <Tooltip title={open ? '收起对话历史' : '对话历史'} placement="right">
          <Button
            type={open ? 'primary' : 'text'}
            size="small"
            icon={<HistoryOutlined />}
            onClick={() => setOpen(!open)}
          />
        </Tooltip>

        <Tooltip title="新建对话" placement="right">
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleNew}
          />
        </Tooltip>
      </div>

      {/* ===== 内容面板（条件渲染） ===== */}
      {open && (
        <div
          style={{
            width: 240,
            maxHeight: '100vh',
            borderRight: '1px solid var(--color-border)',
            padding: '16px 16px 16px 20px',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          {/* 标题行 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={5} style={{ margin: 0 }}>
              <HistoryOutlined /> 对话历史
            </Title>
          </div>

          {/* 新建按钮 */}
          <Button type="primary" block icon={<PlusOutlined />} onClick={handleNew}>
            新建对话
          </Button>

          {/* 会话列表 */}
          <List
            dataSource={conversations}
            locale={{ emptyText: '暂无历史对话' }}
            renderItem={(conv) => {
              const isActive = conv.id === currentConversationId;
              return (
                <List.Item
                  onClick={() => handleSwitch(conv.id)}
                  style={{
                    cursor: 'pointer',
                    padding: '10px 12px',
                    borderRadius: 8,
                    marginBottom: 4,
                    background: isActive ? 'var(--color-primary-bg)' : 'transparent',
                    border: isActive ? '1px solid var(--color-primary)' : '1px solid transparent',
                    transition: 'background 0.15s, border-color 0.15s',
                  }}
                  actions={[
                    <Popconfirm
                      key="del"
                      title="确定删除该对话？"
                      onConfirm={(e) => {
                        e?.stopPropagation();
                        handleDelete(conv.id);
                      }}
                      onCancel={(e) => e?.stopPropagation()}
                    >
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Popconfirm>,
                  ]}
                >
                  <List.Item.Meta
                    title={
                      <Text
                        ellipsis
                        style={{
                          fontWeight: isActive ? 600 : 400,
                          fontSize: 13,
                          maxWidth: 170,
                        }}
                      >
                        {conv.title}
                      </Text>
                    }
                    description={
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {conv.messages.length} 条消息 · {formatDate(conv.updated_at)}
                      </Text>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </div>
      )}
    </div>
  );
}

export default ChatHistorySidebar;
