import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Card, Tag, Space, Spin, Result } from 'antd';
import { PlusOutlined, ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import type { KB } from '../types';
import { useKBStore } from '../stores/kbStore';
import { getKBs } from '../api';
import EmptyState from '../components/EmptyState';

// ========== Mock 兜底数据（API 不可用时） ==========
const MOCK_KBS: KB[] = [
  {
    id: 'kb_001',
    name: '深度学习基础',
    description: '吴恩达课程笔记 + CS231n 整理',
    tags: ['深度学习', '入门'],
    doc_count: 8,
    created_at: '2026-07-20',
  },
  {
    id: 'kb_002',
    name: '计算机组成原理',
    description: '期末复习资料汇总',
    tags: ['计组'],
    doc_count: 5,
    created_at: '2026-07-21',
  },
];

function KBList() {
  const navigate = useNavigate();
  const storeKbs = useKBStore((s) => s.kbs);
  const setKBs = useKBStore((s) => s.setKBs);
  const setCurrentKbId = useKBStore((s) => s.setCurrentKbId);

  const [kbs, setLocalKbs] = useState<KB[]>(storeKbs.length > 0 ? storeKbs : []);
  const [loading, setLoading] = useState(storeKbs.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // 首次加载：retryKey 变化时重新触发（重试按钮递增 retryKey）
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const list = await getKBs();
        if (!cancelled) {
          if (list.length > 0) {
            setLocalKbs(list);
            setKBs(list);
          } else {
            // API 返回空 → Mock 兜底（过渡期，Phase 4 移除）
            console.warn('[KBList] API 返回空，使用 Mock 数据');
            setLocalKbs(MOCK_KBS);
            setKBs(MOCK_KBS);
          }
        }
      } catch {
        if (!cancelled) {
          console.warn('[KBList] API 不可用，使用 Mock 数据');
          setLocalKbs(MOCK_KBS);
          setKBs(MOCK_KBS);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
    // setKBs: Zustand setter 稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  // 重试：清 error + 递增 key 触发 effect 重新加载
  const handleRetry = () => {
    setError(null);
    setRetryKey((k) => k + 1);
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) => (
        <Space>
          {tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: '文档数',
      dataIndex: 'doc_count',
      key: 'doc_count',
      width: 80,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: KB) => (
        <Button
          type="link"
          onClick={() => {
            setCurrentKbId(record.id);
            navigate('/wendang');
          }}
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <div style={{ height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
      <Card
        title={
          <Space>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/')}
            />
            我的知识库
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />}>
            新建知识库
          </Button>
        }
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' } }}
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
            <Spin />
          </div>
        ) : kbs.length === 0 ? (
          <EmptyState type="kb" />
        ) : (
          <Table
            dataSource={kbs}
            columns={columns}
            rowKey="id"
            scroll={{ y: 'calc(100vh - 300px)' }}
            pagination={kbs.length > 15 ? { pageSize: 15 } : false}
          />
        )}
      </Card>
    </div>
  );
}

export default KBList;
