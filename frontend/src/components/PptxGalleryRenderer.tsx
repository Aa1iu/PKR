/**
 * PPTX 幻灯片画廊渲染器 — 图片分页展示
 *
 * 依赖后端 GET /api/kbs/{kb_id}/docs/{doc_id}/page-image?page=N 返回 PNG。
 * 静态画廊：上一页/下一页切换，无动画。
 */

import { useState } from 'react';
import { Button, Space, Spin, Typography } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import { getPageImageUrl } from '../api/documents';

const { Text } = Typography;

interface Props {
  kbId: string;
  docId: string;
  totalPages: number;
}

function PptxGalleryRenderer({ kbId, docId, totalPages }: Props) {
  const [page, setPage] = useState(1);
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  const goTo = (p: number) => {
    if (p < 1 || p > totalPages) return;
    setImgLoading(true);
    setImgError(false);
    setPage(p);
  };

  const imgUrl = getPageImageUrl(kbId, docId, page);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      {/* 幻灯片图片区 */}
      <div
        style={{
          width: '100%',
          minHeight: 300,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--color-surface-secondary)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {imgLoading && !imgError && (
          <Spin style={{ padding: 48 }} />
        )}
        {imgError && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <Text type="secondary">幻灯片图片加载失败</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              请确认后端 /page-image 端点已就绪
            </Text>
          </div>
        )}
        <img
          src={imgUrl}
          alt={`第 ${page} 页`}
          onLoad={() => setImgLoading(false)}
          onError={() => { setImgLoading(false); setImgError(true); }}
          style={{
            maxWidth: '100%',
            maxHeight: 'calc(100vh - 280px)',
            display: imgLoading || imgError ? 'none' : 'block',
          }}
        />
      </div>

      {/* 分页导航 */}
      {totalPages > 1 && (
        <Space>
          <Button
            icon={<LeftOutlined />}
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
          >
            上一页
          </Button>
          <Text type="secondary">{page} / {totalPages}</Text>
          <Button
            icon={<RightOutlined />}
            onClick={() => goTo(page + 1)}
            disabled={page >= totalPages}
          >
            下一页
          </Button>
        </Space>
      )}
    </div>
  );
}

export default PptxGalleryRenderer;
