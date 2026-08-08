import { Button, Empty } from 'antd';
import { PlusOutlined, UploadOutlined } from '@ant-design/icons';

interface EmptyStateProps {
  type?: 'kb' | 'doc';
  onAction?: () => void;
}

const CONTENT: Record<'kb' | 'doc', { title: string; description: string; icon: typeof PlusOutlined }> = {
  kb: {
    title: '还没有知识库',
    description: '创建第一个知识库，开始构建知识图谱',
    icon: PlusOutlined,
  },
  doc: {
    title: '还没有文档',
    description: '上传第一篇文档开始使用',
    icon: UploadOutlined,
  },
};

/** 内联 SVG 插图：圆形底 + 文档图标 + 加号徽章，主题色自适应 */
function PlaceholderSvg() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* 背景圆 */}
      <circle cx="60" cy="58" r="46" style={{ fill: 'var(--color-primary-bg)' }} />

      {/* 文档主体 */}
      <rect
        x="39" y="34" width="42" height="48" rx="4"
        style={{ fill: 'var(--color-surface)', stroke: 'var(--color-primary)' }}
        strokeWidth="2"
      />

      {/* 文档折角 */}
      <path
        d="M68.5 34V42.5C68.5 43.88 69.62 45 71 45H81"
        style={{ fill: 'var(--color-primary-bg)', stroke: 'var(--color-primary)' }}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* 文字占位行 */}
      {[[48,24],[57,32],[66,18],[75,28]].map(([y, w], i) => (
        <rect
          key={i}
          x="47" y={y} width={w} height="3" rx="1.5"
          style={{ fill: 'var(--color-primary)', opacity: 0.35 }}
        />
      ))}

      {/* 加号徽章 */}
      <circle
        cx="82" cy="82" r="13"
        style={{ fill: 'var(--color-surface)', stroke: 'var(--color-primary)' }}
        strokeWidth="2"
      />
      <line x1="76" y1="82" x2="88" y2="82"
        style={{ stroke: 'var(--color-primary)' }} strokeWidth="2.5" strokeLinecap="round"
      />
      <line x1="82" y1="76" x2="82" y2="88"
        style={{ stroke: 'var(--color-primary)' }} strokeWidth="2.5" strokeLinecap="round"
      />
    </svg>
  );
}

function EmptyState({ type = 'kb', onAction }: EmptyStateProps) {
  const { title, description, icon: Icon } = CONTENT[type];

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 0',
      }}
    >
      <Empty
        image={<PlaceholderSvg />}
        description={
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--color-text)', marginBottom: 4 }}>
              {title}
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
              {description}
            </div>
          </div>
        }
      >
        {onAction && (
          <Button type="primary" icon={<Icon />} onClick={onAction}>
            {title === '还没有知识库' ? '新建知识库' : '上传文档'}
          </Button>
        )}
      </Empty>
    </div>
  );
}

export default EmptyState;
