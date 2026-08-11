import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, List, Tag, Space, Typography, message } from 'antd';
import { FileTextOutlined, InboxOutlined } from '@ant-design/icons';
import type { Doc } from '../types';

const { Title, Text } = Typography;

/** 允许的文件扩展名（拖拽校验用） */
const ALLOWED_EXTS = ['pdf', 'docx', 'pptx', 'md', 'txt'];

interface Props {
  docs: Doc[];
  sidebarWidth: number;
  /** 文件拖拽上传回调（主页传入，用于复用上传逻辑） */
  onDocDrop?: (file: File) => void;
}

/** 侧边栏 — 文档列表（支持拖拽上传） */
function SidebarDocList({ docs, sidebarWidth, onDocDrop }: Props) {
  const navigate = useNavigate();
  const [isDragOver, setIsDragOver] = useState(false);

  const statusMap: Record<Doc['status'], { color: string; label: string }> = {
    processing: { color: 'blue', label: '解析中' },
    ready: { color: 'green', label: '已就绪' },
    analyzed: { color: 'green', label: '已分析' },
    error: { color: 'red', label: '失败' },
    failed: { color: 'red', label: '失败' },
  };

  // ===== 拖拽事件处理 =====
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // 只在真正离开容器时取消高亮
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    if (!onDocDrop) {
      message.info('文档上传功能将在 Phase 2 接入');
      return;
    }

    // 逐个处理拖入的文件
    files.forEach((file) => {
      // 前端快速校验扩展名
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      if (!ALLOWED_EXTS.includes(ext)) {
        message.error(`不支持的文件类型：.${ext}`);
        return;
      }
      onDocDrop(file);
    });
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        borderTop: '1px solid var(--color-border)',
        marginTop: 16,
        paddingTop: 16,
        // 拖拽悬停时的视觉效果
        transition: 'background 0.2s, border-color 0.2s',
        background: isDragOver ? 'var(--color-primary-bg)' : 'transparent',
        border: isDragOver ? '2px dashed var(--color-primary)' : '2px solid transparent',
        borderRadius: isDragOver ? 8 : 0,
        paddingLeft: isDragOver ? 12 : 0,
        paddingRight: isDragOver ? 12 : 0,
        paddingBottom: isDragOver ? 12 : 0,
        marginLeft: isDragOver ? -12 : 0,
        marginRight: isDragOver ? -12 : 0,
      }}
    >
      {/* 标题行 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={5} style={{ margin: 0 }}>
          <FileTextOutlined /> 文档列表
        </Title>
        {isDragOver && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            <InboxOutlined /> 释放文件以上传
          </Text>
        )}
      </div>

      {/* 拖拽悬停提示（列表为空时显示上传区域） */}
      {isDragOver && docs.length === 0 && (
        <div
          style={{
            marginTop: 12,
            padding: '24px 0',
            textAlign: 'center',
            color: 'var(--color-primary)',
          }}
        >
          <InboxOutlined style={{ fontSize: 32 }} />
          <p style={{ marginTop: 8 }}>释放文件以添加到知识库</p>
        </div>
      )}

      {/* 文档列表 */}
      <List
        dataSource={docs}
        renderItem={(doc) => {
          const showType = sidebarWidth > 280;
          const showStatus = sidebarWidth > 240;

          return (
            <List.Item style={{ cursor: 'pointer' }}>
              <List.Item.Meta
                title={<Text style={{ fontSize: 13 }}>{doc.filename}</Text>}
                description={
                  showType || showStatus ? (
                    <Space size={4}>
                      {showType && <Tag style={{ fontSize: 11 }}>{doc.type.toUpperCase()}</Tag>}
                      {showStatus && (
                        <Tag color={statusMap[doc.status].color} style={{ fontSize: 11 }}>
                          {statusMap[doc.status].label}
                        </Tag>
                      )}
                    </Space>
                  ) : undefined
                }
              />
            </List.Item>
          );
        }}
      />

      {/* 底部按钮 */}
      <div style={{ marginTop: 12 }}>
        {sidebarWidth > 300 ? (
          <Button icon={<FileTextOutlined />} onClick={() => navigate('/wendang')} block>
            管理所有文档
          </Button>
        ) : (
          <Button
            icon={<FileTextOutlined />}
            onClick={() => navigate('/wendang')}
            title="管理所有文档"
            style={{ width: '100%' }}
          />
        )}
      </div>
    </div>
  );
}

export default SidebarDocList;
