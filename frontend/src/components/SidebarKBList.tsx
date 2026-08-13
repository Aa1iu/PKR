import { useNavigate } from 'react-router-dom';
import { Button, List, Tag, Space, Typography } from 'antd';
import { BookOutlined, AppstoreOutlined, FolderOpenOutlined } from '@ant-design/icons';
import type { KB } from '../types';
import { useKBStore } from '../stores/kbStore';

const { Title, Text } = Typography;

interface Props {
  kbs: KB[];
  sidebarWidth: number;
}

/** 侧边栏 — 知识库列表 */
function SidebarKBList({ kbs, sidebarWidth }: Props) {
  const navigate = useNavigate();
  const currentKbId = useKBStore((s) => s.currentKbId);
  const setCurrentKbId = useKBStore((s) => s.setCurrentKbId);

  return (
    <div>
      {/* 标题行 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          <BookOutlined /> 知识库列表
        </Title>
      </div>

      {/* KB 列表 */}
      <List
        dataSource={kbs}
        renderItem={(kb) => {
          const showDesc = sidebarWidth > 360;
          const showTags = sidebarWidth > 300;
          const showCount = sidebarWidth > 250;

          const isActive = kb.id === currentKbId;
          return (
            <List.Item
              style={{
                cursor: 'pointer',
                borderRadius: 8,
                padding: '4px 8px',
                marginBottom: 2,
                background: isActive ? 'var(--color-primary-bg)' : 'transparent',
                border: isActive ? '1px solid var(--color-primary)' : '1px solid transparent',
                transition: 'background 0.2s, border-color 0.2s',
              }}
              onClick={() => setCurrentKbId(kb.id)}
              actions={[
                <Button
                  key="view"
                  type="link"
                  size="small"
                  icon={<FolderOpenOutlined />}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentKbId(kb.id);
                    navigate('/wendang');
                  }}
                >
                  查看文档
                </Button>,
              ]}
            >
              <List.Item.Meta
                title={<span style={{ fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--color-primary)' : undefined }}>{kb.name}</span>}
                description={
                  showDesc || showTags || showCount ? (
                    <Space size={4}>
                      {showDesc && <Text type="secondary">{kb.description}</Text>}
                      {showTags && (
                        <Space>
                          {kb.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
                        </Space>
                      )}
                      {showCount && <Text type="secondary">{kb.doc_count ?? 0} 篇文档</Text>}
                    </Space>
                  ) : undefined
                }
              />
            </List.Item>
          );
        }}
      />

      {/* 底部按钮 */}
      <div style={{ marginTop: 16 }}>
        {sidebarWidth > 300 ? (
          <Button type="primary" icon={<AppstoreOutlined />} onClick={() => navigate('/zhishiku')} block>
            管理所有知识库
          </Button>
        ) : (
          <Button
            type="primary"
            icon={<AppstoreOutlined />}
            onClick={() => navigate('/zhishiku')}
            title="管理所有知识库"
            style={{ width: '100%' }}
          />
        )}
      </div>
    </div>
  );
}

export default SidebarKBList;
