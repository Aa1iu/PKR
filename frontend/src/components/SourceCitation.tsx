import { useState } from 'react';
import { Tag, Tooltip, Typography } from 'antd';
import { FileTextOutlined, NumberOutlined } from '@ant-design/icons';
import type { ChatMessage } from '../types';

const { Text } = Typography;

interface Props {
  sources?: ChatMessage['sources'];
}

/**
 * 来源引用组件 — 在 AI 回复气泡底部展示引用的文档来源
 *
 * 每条 source 显示为一个小标签/卡片：
 *   - 文档名 + 页码（始终可见）
 *   - hover Tooltip 展示 chunk_text 片段 + 相关度 score
 *   - 未来可点击跳转到文档阅读器
 */
function SourceCitation({ sources }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  // 默认展示前 3 条，expanded 时展示全部
  const visible = expanded ? sources : sources.slice(0, 3);
  const hasMore = sources.length > 3;

  return (
    <div style={{ marginTop: 10, borderTop: '1px solid var(--color-border)', paddingTop: 8 }}>
      {/* 标题行 */}
      <Text type="secondary" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>
        <FileTextOutlined style={{ marginRight: 4 }} />
        参考来源 ({sources.length})
      </Text>

      {/* 来源标签列表 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {visible.map((src, i) => (
          <Tooltip
            key={i}
            title={
              <div style={{ maxWidth: 320 }}>
                <div style={{ marginBottom: 4, fontWeight: 500 }}>{src.doc_name}</div>
                <div style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 4, opacity: 0.9 }}>
                  {src.chunk_text.length > 150
                    ? src.chunk_text.slice(0, 150) + '...'
                    : src.chunk_text}
                </div>
                <div style={{ fontSize: 11, opacity: 0.7 }}>
                  相关度：{(src.score * 100).toFixed(0)}% · 第 {src.page} 页
                </div>
              </div>
            }
          >
            <Tag
              color="blue"
              style={{
                cursor: 'pointer',
                margin: 0,
                padding: '2px 8px',
                fontSize: 12,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <FileTextOutlined style={{ fontSize: 10 }} />
              <span>{src.doc_name}</span>
              <span style={{ opacity: 0.7 }}>
                <NumberOutlined style={{ fontSize: 10 }} />
                {src.page}
              </span>
            </Tag>
          </Tooltip>
        ))}

        {/* 展开/收起按钮 */}
        {hasMore && (
          <Tag
            style={{
              cursor: 'pointer',
              margin: 0,
              padding: '2px 8px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px dashed var(--color-border-secondary)',
              background: 'transparent',
            }}
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '收起' : `+${sources.length - 3} 更多`}
          </Tag>
        )}
      </div>
    </div>
  );
}

export default SourceCitation;
