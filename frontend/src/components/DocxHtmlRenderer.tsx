/**
 * DOCX 文档渲染器 — 前端 mammoth.js 转 HTML
 *
 * 获取原始 DOCX 文件 ArrayBuffer → mammoth.convertToHtml() → 渲染 HTML。
 * 依赖后端 GET /api/kbs/{kb_id}/docs/{doc_id}/file 返回文件流。
 */

import { useEffect, useState } from 'react';
import { Spin, Typography } from 'antd';
import mammoth from 'mammoth';
import { getDocumentFileUrl } from '../api/documents';

const { Text } = Typography;

interface Props {
  kbId: string;
  docId: string;
}

function DocxHtmlRenderer({ kbId, docId }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const url = getDocumentFileUrl(kbId, docId);
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`文件请求失败 (${res.status})`);
        }
        const arrayBuffer = await res.arrayBuffer();
        const result = await mammoth.convertToHtml({ arrayBuffer });
        if (!cancelled) {
          setHtml(result.value);
          if (result.messages?.length) {
            console.warn('[DocxHtmlRenderer] mammoth 警告:', result.messages);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'DOCX 渲染失败');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [kbId, docId]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 48 }}><Spin tip="正在解析文档…" /></div>;
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <Text type="danger">{error}</Text>
        <br />
        <Text type="secondary">请确认后端 /file 端点已就绪</Text>
      </div>
    );
  }

  return (
    <div
      className="docx-content"
      dangerouslySetInnerHTML={{ __html: html || '' }}
      style={{
        fontSize: 15,
        lineHeight: 1.85,
        color: 'var(--color-text)',
        wordBreak: 'break-word',
      }}
    />
  );
}

export default DocxHtmlRenderer;
