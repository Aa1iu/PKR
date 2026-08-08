import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

/** Markdown 渲染器 — 用于 AI 回复、文档阅读等场景 */
function MarkdownRenderer({ content }: { content: string }) {
  return (
    <div className="markdown-body" style={{ fontSize: 14, lineHeight: 1.7 }}>
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  );
}

/**
 * 自定义组件渲染规则
 * 让 Markdown 各元素适配 Ant Design 风格 & 主题切换
 */
const components: Components = {
  // ===== 代码块 =====
  code: ({ className, children, ...props }) => {
    const isBlock = className?.startsWith('language-');
    const language = className?.replace('language-', '') || '';

    if (isBlock) {
      return (
        <div style={{ margin: '12px 0', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--color-border-secondary)' }}>
          {/* 代码块顶栏 — 显示语言 */}
          {language && (
            <div
              style={{
                padding: '4px 12px',
                fontSize: 12,
                color: 'var(--color-text-secondary)',
                background: 'var(--color-surface-secondary)',
                borderBottom: '1px solid var(--color-border-secondary)',
                fontFamily: 'monospace',
              }}
            >
              {language}
            </div>
          )}
          <pre
            style={{
              margin: 0,
              padding: '14px 16px',
              background: 'var(--color-code-bg)',
              color: 'var(--color-code-text)',
              overflowX: 'auto',
              fontSize: 13,
              lineHeight: 1.6,
              fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace",
            }}
          >
            <code>{String(children).replace(/\n$/, '')}</code>
          </pre>
        </div>
      );
    }

    // 行内代码
    return (
      <code
        style={{
          padding: '2px 6px',
          borderRadius: 4,
          background: 'var(--color-surface)',
          color: 'var(--color-code-inline)',
          fontSize: '0.9em',
          fontFamily: "'Fira Code', Consolas, monospace",
          border: '1px solid var(--color-border-secondary)',
        }}
        {...props}
      >
        {children}
      </code>
    );
  },

  // ===== 表格 =====
  table: ({ children }) => (
    <div style={{ overflowX: 'auto', margin: '12px 0' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: '1px solid var(--color-border-secondary)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ background: 'var(--color-surface-secondary)' }}>{children}</thead>
  ),
  th: ({ children }) => (
    <th
      style={{
        padding: '10px 14px',
        textAlign: 'left',
        fontWeight: 600,
        borderBottom: '2px solid var(--color-border-secondary)',
        borderRight: '1px solid var(--color-border)',
        fontSize: 13,
      }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td
      style={{
        padding: '8px 14px',
        borderBottom: '1px solid var(--color-border)',
        borderRight: '1px solid var(--color-border)',
        fontSize: 13,
      }}
    >
      {children}
    </td>
  ),

  // ===== 引用块 =====
  blockquote: ({ children }) => (
    <blockquote
      style={{
        margin: '12px 0',
        padding: '8px 16px',
        borderLeft: '4px solid var(--color-primary)',
        background: 'var(--color-primary-bg)',
        borderRadius: '0 6px 6px 0',
        color: 'var(--color-blockquote-text)',
      }}
    >
      {children}
    </blockquote>
  ),

  // ===== 链接 =====
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary)' }}>
      {children}
    </a>
  ),

  // ===== 列表 =====
  ul: ({ children }) => (
    <ul style={{ paddingLeft: 20, margin: '8px 0' }}>{children}</ul>
  ),
  ol: ({ children }) => (
    <ol style={{ paddingLeft: 20, margin: '8px 0' }}>{children}</ol>
  ),
  li: ({ children }) => (
    <li style={{ marginBottom: 4, lineHeight: 1.7 }}>{children}</li>
  ),

  // ===== 标题 =====
  h1: ({ children }) => (
    <h1 style={{ fontSize: '1.5em', fontWeight: 600, margin: '16px 0 8px', borderBottom: '1px solid var(--color-border)', paddingBottom: 6 }}>
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 style={{ fontSize: '1.3em', fontWeight: 600, margin: '14px 0 6px' }}>{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 style={{ fontSize: '1.15em', fontWeight: 600, margin: '12px 0 4px' }}>{children}</h3>
  ),

  // ===== 段落 & 分割线 =====
  p: ({ children }) => (
    <p style={{ margin: '6px 0' }}>{children}</p>
  ),
  hr: () => (
    <hr style={{ border: 'none', borderTop: '1px solid var(--color-border)', margin: '16px 0' }} />
  ),

  // ===== 强调 =====
  strong: ({ children }) => (
    <strong style={{ fontWeight: 600 }}>{children}</strong>
  ),
};

export default MarkdownRenderer;
