import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Upload, Table, Tag, Space, Typography, message, Spin, Result } from 'antd';
import { ArrowLeftOutlined, InboxOutlined, DeleteOutlined, EyeOutlined, ApartmentOutlined, ReloadOutlined } from '@ant-design/icons';
import type { Doc } from '../types';
import type { UploadProps } from 'antd';
import { validateFileType, uploadDocToKB } from '../utils/upload';
import { getDocuments, deleteDocument as apiDeleteDoc } from '../api';
import { useKBStore } from '../stores/kbStore';
import EmptyState from '../components/EmptyState';

const { Dragger } = Upload;
const { Title, Text } = Typography;

function KBDetail() {
  const navigate = useNavigate();
  const currentKbId = useKBStore((s) => s.currentKbId);
  const setCurrentKbId = useKBStore((s) => s.setCurrentKbId);

  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // 刷新后 store 丢失 currentKbId → 自动从 API 加载 KB 列表并选中第一个
  useEffect(() => {
    if (currentKbId) return;

    let cancelled = false;
    (async () => {
      try {
        const { getKBs } = await import('../api');
        const list = await getKBs();
        if (!cancelled && list.length > 0) {
          setCurrentKbId(list[0].id);
        } else if (!cancelled) {
          setLoading(false);
          setError('还没有知识库，请先创建');
        }
      } catch {
        if (!cancelled) {
          setLoading(false);
          setError('加载知识库列表失败，请确认后端已启动');
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 加载文档列表
  useEffect(() => {
    if (!currentKbId) return;

    let cancelled = false;

    async function load() {
      try {
        const list = await getDocuments(currentKbId!);
        if (!cancelled) {
          setDocs(list);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : '加载文档列表失败，请确认后端已启动';
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [currentKbId, retryKey]);

  // 重试
  const handleRetry = () => {
    setError(null);
    setRetryKey((k) => k + 1);
  };

  // ===== 上传 =====
  const handleUpload = useCallback(
    async (file: File): Promise<boolean> => {
      if (!validateFileType(file)) return false;

      if (!currentKbId) {
        message.warning('请先选择知识库');
        return false;
      }

      const doc = await uploadDocToKB(currentKbId, file);
      if (doc) {
        setDocs((prev) => [doc, ...prev]);
        return true;
      }
      return false;
    },
    [currentKbId],
  );

  // ===== 上传组件配置 =====
  const uploadProps: UploadProps = {
    name: 'file',
    multiple: true,
    showUploadList: {
      showDownloadIcon: false,
      showPreviewIcon: true,
      showRemoveIcon: true,
    },
    customRequest: (options) => {
      const { file, onSuccess, onError } = options;
      handleUpload(file as File).then((ok) => {
        if (ok) onSuccess?.('ok');
        else onError?.(new Error('上传失败'));
      });
    },
  };

  // ===== 删除 =====
  const handleDelete = useCallback(
    async (docId: string, filename: string) => {
      if (!currentKbId) return;

      try {
        await apiDeleteDoc(currentKbId, docId);
        setDocs((prev) => prev.filter((d) => d.doc_id !== docId));
        message.success(`已删除「${filename}」`);
      } catch {
        message.error('删除失败，请稍后重试');
      }
    },
    [currentKbId],
  );

  // ===== 表格列 =====
  const columns = [
    {
      title: '文件名',
      dataIndex: 'filename',
      key: 'filename',
      width: 220,
      ellipsis: true,
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 80,
      render: (t: string) => <Tag>{t.toUpperCase()}</Tag>,
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 100,
    },
    {
      title: '页数',
      dataIndex: 'pages',
      key: 'pages',
      width: 70,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (s: Doc['status']) => {
        const map: Record<string, { color: string; label: string }> = {
          processing: { color: 'blue', label: '解析中' },
          ready: { color: 'green', label: '已就绪' },
          error: { color: 'red', label: '失败' },
        };
        const item = map[s] || { color: 'default' as const, label: s };
        return <Tag color={item.color}>{item.label}</Tag>;
      },
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 110,
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_: unknown, record: Doc) => (
        <Space size={0}>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/wendang/${record.doc_id}`, { state: { kbId: currentKbId } })}
          >
            阅读
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.doc_id, record.filename)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  // ===== 渲染 =====
  return (
    <div style={{ height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部导航栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} />
        <Title level={3} style={{ margin: 0 }}>
          文档管理
        </Title>
        <Button
          type="text"
          icon={<ApartmentOutlined />}
          onClick={() => navigate('/tupu')}
          style={{ marginLeft: 'auto' }}
        >
          知识图谱
        </Button>
        <Text type="secondary">共 {docs.length} 篇文档</Text>
      </div>

      {/* 文档上传区域 */}
      <Card style={{ marginTop: 16, flexShrink: 0 }}>
        <Dragger {...uploadProps} disabled={!currentKbId}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
          <p className="ant-upload-hint">
            支持 PDF、Word (.docx)、PowerPoint (.pptx)、Markdown (.md)、TXT 格式
          </p>
          {!currentKbId && (
            <p className="ant-upload-hint" style={{ color: 'var(--color-warning)' }}>
              请先在侧边栏选择一个知识库
            </p>
          )}
        </Dragger>
      </Card>

      {/* 文档列表 */}
      <Card
        title={`文档列表 (${docs.length})`}
        style={{ marginTop: 16, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
        styles={{ body: { flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' } }}
      >
        {error ? (
          <Result
            status="error"
            title="数据加载失败"
            subTitle={error}
            extra={
              <Button type="primary" icon={<ReloadOutlined />} onClick={handleRetry}>
                重新加载
              </Button>
            }
          />
        ) : loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin /><Text type="secondary" style={{ marginTop: 8 }}>加载文档列表...</Text>
          </div>
        ) : docs.length === 0 ? (
          <EmptyState type="doc" />
        ) : (
          <Table
            dataSource={docs}
            columns={columns}
            rowKey="doc_id"
            scroll={{ y: 'calc(100vh - 460px)' }}
            pagination={docs.length > 15 ? { pageSize: 15 } : false}
          />
        )}
      </Card>
    </div>
  );
}

export default KBDetail;
