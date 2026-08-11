import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Select, Typography, Spin, Empty, Result } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import type { KB, Doc } from '../types';
import { getKBs, getDocuments } from '../api';
import KnowledgeGraph from '../components/KnowledgeGraph';
import { useGraphStore } from '../stores/graphStore';
import { useKBStore } from '../stores/kbStore';

const { Title, Text } = Typography;

/** 知识图谱页 */
function GraphPage() {
  const navigate = useNavigate();
  const kbStore = useKBStore();
  const currentKbId = kbStore.currentKbId;
  const setCurrentKbId = kbStore.setCurrentKbId;
  const setKBs = kbStore.setKBs;
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const loading = useGraphStore((s) => s.loading);
  const error = useGraphStore((s) => s.error);
  const fetchGraph = useGraphStore((s) => s.fetchGraph);

  const [kbs, setLocalKbs] = useState<KB[]>([]);
  const [kbsLoading, setKbsLoading] = useState(true);
  const [docs, setDocs] = useState<Doc[]>([]);

  // 加载知识库列表
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const list = await getKBs();
        if (!cancelled) {
          setLocalKbs(list);
          setKBs(list);
          // 如果还没有选中知识库，自动选第一个
          if (!currentKbId && list.length > 0) {
            setCurrentKbId(list[0].id);
          }
        }
      } catch {
        // 静默失败
      } finally {
        if (!cancelled) setKbsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 加载当前知识库的文档列表（用于 doc_id → filename 映射）
  useEffect(() => {
    if (!currentKbId) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await getDocuments(currentKbId);
        if (!cancelled) setDocs(list);
      } catch {
        if (!cancelled) setDocs([]);
      }
    })();
    return () => { cancelled = true; };
  }, [currentKbId]);

  // doc_id → filename 映射
  const docNames = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    docs.forEach((d) => { map[d.doc_id] = d.filename; });
    return map;
  }, [docs]);

  // 当前知识库变化时拉取图谱
  useEffect(() => {
    if (currentKbId) {
      fetchGraph(currentKbId);
    }
  }, [fetchGraph, currentKbId]);

  const handleRetry = () => {
    if (currentKbId) fetchGraph(currentKbId);
  };

  /** 切换知识库 */
  const handleKbChange = (kbId: string) => {
    setCurrentKbId(kbId);
  };

  return (
    <div style={{ height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部导航栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} />
        <Title level={3} style={{ margin: 0 }}>
          知识图谱
        </Title>

        {/* 知识库选择器 */}
        <Select
          value={currentKbId || undefined}
          onChange={handleKbChange}
          placeholder={kbsLoading ? '加载中...' : '选择知识库'}
          loading={kbsLoading}
          disabled={kbsLoading}
          style={{ minWidth: 200 }}
          options={kbs.map((kb) => ({
            value: kb.id,
            label: `${kb.name} (${kb.doc_count ?? 0} 篇文档)`,
          }))}
          notFoundContent={
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无知识库"
              style={{ margin: '8px 0' }}
            />
          }
        />

        <Text type="secondary" style={{ marginLeft: 'auto' }}>
          共 {nodes.length} 个节点 · {edges.length} 条关系
        </Text>
      </div>

      {/* 图谱画布 */}
      <Card
        style={{ marginTop: 16, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
      >
        {!currentKbId ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="请先在文档管理页选择知识库" />
          </div>
        ) : error ? (
          <Result
            status="error"
            title="图谱加载失败"
            subTitle={error}
            extra={
              <Button type="primary" icon={<ReloadOutlined />} onClick={handleRetry}>
                重新加载
              </Button>
            }
          />
        ) : loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8 }}>
            <Spin />
            <Text type="secondary">加载图谱数据...</Text>
          </div>
        ) : nodes.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="该知识库还没有图谱数据，请先导入文档并运行分析" />
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0 }}>
            <KnowledgeGraph nodes={nodes} edges={edges} docNames={docNames} />
          </div>
        )}
      </Card>
    </div>
  );
}

export default GraphPage;
