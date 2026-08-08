import { Typography } from 'antd';

const { Text } = Typography;

interface Props {
  /** 后端 PyMuPDF 提取的单页文本 */
  content: string;
}

/**
 * PDF 分页文本渲染器
 *
 * 接收后端 PyMuPDF 按页提取的纯文本，智能拆分段落并渲染。
 * 与 MarkdownRenderer 互补——Markdown 文件走 MarkdownRenderer，
 * PDF/DOCX/TXT 等纯文本格式走本组件。
 *
 * Phase 2: 对接 GET /api/kbs/{kb_id}/docs/{doc_id}/content?page=N
 */
function PdfPageRenderer({ content }: Props) {
  if (!content?.trim()) {
    return <Text type="secondary">（本页无文本内容）</Text>;
  }

  // 按双换行拆分段落（兼容 \n\n 和 \r\n\r\n）
  const paragraphs = content
    .replace(/\r\n/g, '\n')
    .split(/\n\n+/)
    .filter((p) => p.trim());

  return (
    <div>
      {paragraphs.map((raw, i) => {
        // 段落内单换行合并为一个空格（PDF 换行通常非语义）
        const text = raw.replace(/\n/g, ' ').trim();

        return (
          <p
            key={i}
            style={{
              margin: '0 0 14px',
              fontSize: 15,
              lineHeight: 1.85,
              color: 'var(--color-text)',
              textIndent: '2em',
              wordBreak: 'break-word',
            }}
          >
            {text}
          </p>
        );
      })}

      {/* 页脚分割线 */}
      <div
        style={{
          marginTop: 24,
          borderTop: '1px dashed var(--color-border-secondary)',
          opacity: 0.5,
        }}
      />
    </div>
  );
}

export default PdfPageRenderer;
