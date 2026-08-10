import { useState, useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { Button, Card, Typography, Tag, Space, InputNumber, Spin, Result } from 'antd';
import {
  ArrowLeftOutlined,
  LeftOutlined,
  RightOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import MarkdownRenderer from '../components/MarkdownRenderer';
import PdfPageRenderer from '../components/PdfPageRenderer';
import { getDocumentContent, type DocContent } from '../api/documents';
import { useKBStore } from '../stores/kbStore';
import type { Doc } from '../types';

const { Title, Text } = Typography;

// ========== 渲染器选择 ==========

function getRenderer(type: Doc['type'], content: string) {
  switch (type) {
    case 'md':
      return <MarkdownRenderer content={content} />;
    case 'pdf':
    case 'docx':
    case 'txt':
    case 'pptx':
    default:
      return <PdfPageRenderer content={content} />;
  }
}

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  processing: { color: 'blue', label: '解析中' },
  ready: { color: 'green', label: '已就绪' },
  analyzed: { color: 'green', label: '已分析' },
  error: { color: 'red', label: '失败' },
  failed: { color: 'red', label: '失败' },
};

// ========== 组件 ==========

function DocReader() {
  const { docId } = useParams<{ docId: string }>();
  const location = useLocation();
  const statePage = (location.state as { page?: number; kbId?: string; docMeta?: Doc } | null)?.page;
  const stateKbId = (location.state as { kbId?: string } | null)?.kbId;
  const storeKbId = useKBStore((s) => s.currentKbId);
  const kbId = stateKbId || storeKbId;

  const [docMeta, setDocMeta] = useState<Doc | null>(
    (location.state as { docMeta?: Doc } | null)?.docMeta || null,
  );
  const [content, setContent] = useState<DocContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(() =>
    statePage && statePage >= 1 ? statePage : 1,
  );
  const contentRef = useRef<HTMLDivElement>(null);

  // 加载文档内容
  useEffect(() => {
    if (!docId || !kbId) {
      setError('缺少知识库信息，请从文档列表进入');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const data = await getDocumentContent(kbId, docId);
        if (!cancelled) {
          setContent(data);
          // 页码校验
          if (currentPage > data.total_pages) setCurrentPage(data.total_pages);
          else if (currentPage < 1) setCurrentPage(1);
        }
      } catch {
        if (!cancelled) setError('加载文档内容失败，请确认后端已启动');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId, kbId]);

  // 换页滚回顶部
  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [currentPage]);

  // 重置页码（docId 变化时）
  useEffect(() => {
    setCurrentPage(statePage && statePage >= 1 ? statePage : 1);
  }, [docId, statePage]);

  const totalPages = content?.total_pages || 0;
  const currentText = content?.pages[currentPage - 1]?.text || '';

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  // 从 content.pages 推断文档类型（优先用传入的 docMeta）
  const inferredType: Doc['type'] = docMeta?.type || 'txt';
  const displayName = docMeta?.filename || docId || '未知文档';

  // Markdown 文件：拼接全部页一次性渲染，不需要分页
  const isMarkdown = inferredType === 'md';
  const fullMarkdown = isMarkdown
    ? (content?.pages || []).map(p => p.text).join('\n\n')
    : '';
  const showPagination = !isMarkdown && totalPages > 1;

  // ===== 加载态 =====
  if (loading) {
    return (
      <div style={{ height: 'calc(100vh - 48px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" tip="加载文档中…" />
      </div>
    );
  }

  // ===== 错误态 =====
  if (error || !content) {
    return (
      <div style={{ height: 'calc(100vh - 48px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Result
          status="error"
          title="文档加载失败"
          subTitle={error || '未找到文档内容'}
          extra={
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => window.history.back()}>返回</Button>
              <Button type="primary" icon={<ReloadOutlined />} onClick={() => window.location.reload()}>重试</Button>
            </Space>
          }
        />
      </div>
    );
  }

  // ===== 正常渲染 =====
  const statusInfo = STATUS_MAP[docMeta?.status || ''] || { color: 'default', label: docMeta?.status || '未知' };

  return (
    <div style={{ height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部信息栏 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, marginBottom: 16 }}>
        <Space align="center">
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => window.history.back()} />
          <FileTextOutlined style={{ fontSize: 20, color: 'var(--color-primary)' }} />
          <Title level={4} style={{ margin: 0 }}>{displayName}</Title>
          <Tag>{inferredType.toUpperCase()}</Tag>
          {docMeta && <Tag color={statusInfo.color}>{statusInfo.label}</Tag>}
        </Space>
        <Space>
          {docMeta && <Text type="secondary">{docMeta.pages} 页</Text>}
        </Space>
      </div>

      {/* 文档内容区 */}
      <Card
        style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
        styles={{ body: { flex: 1, minHeight: 0, overflow: 'hidden', padding: 0 } }}
      >
        <div ref={contentRef} style={{ height: '100%', overflow: 'auto', padding: '24px 32px' }}>
          {isMarkdown
            ? getRenderer('md', fullMarkdown)
            : currentText
              ? getRenderer(inferredType, currentText)
              : <Text type="secondary">（本页无内容）</Text>
          }
        </div>
      </Card>

      {/* 底部分页导航 — Markdown 文件隐藏 */}
      {showPagination && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexShrink: 0, padding: '16px 0 8px' }}>
          <Button icon={<LeftOutlined />} onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
            上一页
          </Button>
          <Space size={4}>
            <InputNumber min={1} max={totalPages} value={currentPage}
              onChange={(v) => v && goToPage(v)} size="small" style={{ width: 60 }} />
            <Text type="secondary">/ {totalPages}</Text>
          </Space>
          <Button icon={<RightOutlined />} onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}>
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}

export default DocReader;
