import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Tag, Typography, Spin, Empty, Result } from 'antd';
import { ArrowLeftOutlined, ReloadOutlined } from '@ant-design/icons';
import KnowledgeGraph from '../components/KnowledgeGraph';
import { useGraphStore } from '../stores/graphStore';
import { useKBStore } from '../stores/kbStore';

const { Title, Text } = Typography;

/** 知识图谱页 — Phase 3（8/4）D3 力导向图基础渲染 */
function GraphPage() {
  const navigate = useNavigate();
  const currentKbId = useKBStore((s) => s.currentKbId);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const loading = useGraphStore((s) => s.loading);
  const error = useGraphStore((s) => s.error);
  const apiAvailable = useGraphStore((s) => s.apiAvailable);
  const fetchGraph = useGraphStore((s) => s.fetchGraph);

  // 无选中知识库时用演示 KB（kb_demo_001）加载 Mock 图谱
  useEffect(() => {
    fetchGraph(currentKbId ?? 'kb_demo_001');
  }, [fetchGraph, currentKbId]);

  return (
    <div style={{ height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column' }}>
      {/* 顶部导航栏 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/wendang')} />
        <Title level={3} style={{ margin: 0 }}>
          知识图谱
        </Title>
        <Text type="secondary">
          共 {nodes.length} 个节点 · {edges.length} 条关系
        </Text>
        {apiAvailable === true && (
          <Tag color="green" style={{ marginLeft: 4 }}>API</Tag>
        )}
        {apiAvailable === false && (
          <Tag color="orange" style={{ marginLeft: 4 }}>Mock</Tag>
        )}
      </div>

      {/* 图谱画布 */}
      <Card
        style={{ marginTop: 16, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } }}
      >
        {error ? (
          <Result
            status="error"
            title="图谱加载失败"
            subTitle={error}
            extra={
              <Button type="primary" icon={<ReloadOutlined />} onClick={() => fetchGraph(currentKbId ?? 'kb_demo_001')}>
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
            <Empty description="图谱暂无数据" />
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0 }}>
            <KnowledgeGraph nodes={nodes} edges={edges} />
          </div>
        )}
      </Card>
    </div>
  );
}

export default GraphPage;
