import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Card, Tag, Space, Spin, Result, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, ArrowLeftOutlined, ReloadOutlined, DeleteOutlined } from '@ant-design/icons';
import type { KB } from '../types';
import { useKBStore } from '../stores/kbStore';
import { getKBs, createKB, deleteKB } from '../api';
import EmptyState from '../components/EmptyState';

function KBList() {
  const navigate = useNavigate();
  const storeKbs = useKBStore((s) => s.kbs);
  const setKBs = useKBStore((s) => s.setKBs);
  const removeKB = useKBStore((s) => s.removeKB);
  const setCurrentKbId = useKBStore((s) => s.setCurrentKbId);

  const [kbs, setLocalKbs] = useState<KB[]>(storeKbs.length > 0 ? storeKbs : []);
  const [loading, setLoading] = useState(storeKbs.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // 首次加载：retryKey 变化时重新触发（重试按钮递增 retryKey）
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const list = await getKBs();
        if (!cancelled) {
          setLocalKbs(list);
          setKBs(list);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : '加载失败，请确认后端已启动';
          setError(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  // 重试
  const handleRetry = () => {
    setError(null);
    setRetryKey((k) => k + 1);
  };

  // 新建知识库
  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const kb = await createKB({
        name: values.name,
        description: values.description,
        tags: values.tags || [],
      });
      // 更新本地状态 + Store
      setLocalKbs((prev) => [kb, ...prev]);
      setKBs([kb, ...storeKbs]);
      form.resetFields();
      setModalVisible(false);
      message.success(`知识库「${kb.name}」创建成功`);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) return; // 表单校验失败，不提示
      const msg = err instanceof Error ? err.message : '创建失败';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // 删除知识库
  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteKB(id);
      setLocalKbs((prev) => prev.filter((kb) => kb.id !== id));
      removeKB(id);
      message.success(`知识库「${name}」已删除`);
    } catch {
      message.error('删除失败，请重试');
    }
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
        <Space>
          <Button
            type="link"
            onClick={() => {
              setCurrentKbId(record.id);
              navigate('/wendang');
            }}
          >
            查看
          </Button>
          <Popconfirm
            title="确认删除"
            description={`确定要删除「${record.name}」吗？`}
            onConfirm={() => handleDelete(record.id, record.name)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
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
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalVisible(true)}>
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

      <Modal
        title="新建知识库"
        open={modalVisible}
        onOk={handleCreate}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        confirmLoading={submitting}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="名称"
            rules={[{ required: true, message: '请输入知识库名称' }]}
          >
            <Input placeholder="例如：深度学习笔记" maxLength={100} />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea placeholder="简要描述知识库内容（选填）" rows={3} maxLength={500} />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Select
              mode="tags"
              placeholder="输入标签后回车添加（选填）"
              style={{ width: '100%' }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default KBList;
