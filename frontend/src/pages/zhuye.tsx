import { useState, useRef, useCallback, useEffect } from 'react';
import { Typography, message } from 'antd';
import type { KB, Doc } from '../types';
import { validateFileType, uploadDocToKB, createMockDoc } from '../utils/upload';
import { getDocuments } from '../api';
import { useKBStore } from '../stores/kbStore';
import ChatPanel from '../components/ChatPanel';
import ChatHistorySidebar from '../components/ChatHistorySidebar';
import Sidebar from '../components/Sidebar';

const { Title, Text } = Typography;

// ========== Mock 兜底数据（API 不可用时） ==========
const MOCK_KBS: KB[] = [
  {
    id: 'kb_001', name: '深度学习基础',
    description: '吴恩达课程笔记 + CS231n 整理',
    tags: ['深度学习', '入门'], doc_count: 8, created_at: '2026-07-20',
  },
  {
    id: 'kb_002', name: '计算机组成原理',
    description: '期末复习资料汇总',
    tags: ['计组'], doc_count: 5, created_at: '2026-07-21',
  },
];

const MOCK_DOCS: Doc[] = [
  { doc_id: 'doc_001', filename: '卷积神经网络详解.pdf', type: 'pdf', pages: 32, size: '2.4 MB', status: 'analyzed', created_at: '2026-07-22' },
  { doc_id: 'doc_002', filename: '反向传播推导过程.docx', type: 'docx', pages: 15, size: '1.1 MB', status: 'analyzed', created_at: '2026-07-23' },
  { doc_id: 'doc_003', filename: '激活函数对比.pptx', type: 'pptx', pages: 28, size: '5.7 MB', status: 'processing', created_at: '2026-07-25' },
];

const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 260;

function Zhuye() {
  // ===== Zustand 全局状态 =====
  const storeKBs = useKBStore((s) => s.kbs);
  const currentKbId = useKBStore((s) => s.currentKbId);
  const setKBs = useKBStore((s) => s.setKBs);
  const setCurrentKbId = useKBStore((s) => s.setCurrentKbId);

  // ===== 本地状态 =====
  const [kbs, setLocalKbs] = useState<KB[]>(MOCK_KBS);
  const [docs, setDocs] = useState<Doc[]>(MOCK_DOCS);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [apiAvailable, setApiAvailable] = useState<boolean | null>(null);
  const dragging = useRef(false);

  // ===== 初始化：同步 store + 尝试加载 KB 列表和文档 =====
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 如果 store 中已有 KBS（比如从 KBList 页回来），直接用
      if (storeKBs.length > 0) {
        setLocalKbs(storeKBs);
        return;
      }

      // 尝试从 API 加载 KB 列表
      try {
        const { getKBs } = await import('../api');
        const list = await getKBs();
        if (!cancelled) {
          setLocalKbs(list);
          setKBs(list);
          setApiAvailable(true);
          // 默认选中第一个知识库
          if (list.length > 0 && !currentKbId) {
            setCurrentKbId(list[0].id);
          }
        }
      } catch {
        if (!cancelled) {
          console.warn('[Zhuye] API 不可用，使用 Mock 数据');
          setKBs(MOCK_KBS);
          setApiAvailable(false);
          // Mock 模式默认选中第一个
          if (!currentKbId) setCurrentKbId(MOCK_KBS[0].id);
        }
      }
    }

    init();
    return () => { cancelled = true; };
    // storeKBs: Zustand 引用稳定；setKBs/setCurrentKbId: Zustand setter 稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== currentKbId 变化时加载对应文档列表 =====
  useEffect(() => {
    if (!currentKbId) return;

    let cancelled = false;

    async function loadDocs() {
      if (apiAvailable === false) return; // 已是 Mock 模式，不请求

      try {
        const list = await getDocuments(currentKbId!);
        if (!cancelled) {
          setDocs(list);
        }
      } catch {
        if (!cancelled) {
          console.warn('[Zhuye] 加载文档失败，保持当前列表');
        }
      }
    }

    loadDocs();
    return () => { cancelled = true; };
  }, [currentKbId, apiAvailable]);

  // ===== 文档拖拽上传回调 =====
  const handleDocDrop = useCallback(
    async (file: File) => {
      if (!validateFileType(file)) return;

      if (currentKbId && apiAvailable !== false) {
        const doc = await uploadDocToKB(currentKbId, file);
        if (doc) {
          setDocs((prev) => [doc, ...prev]);
          return;
        }
        // API 失败 → 后续走 Mock
        setApiAvailable(false);
      }

      // Mock 兜底
      const mockDoc = createMockDoc(file);
      setDocs((prev) => [mockDoc, ...prev]);
      message.success(`${file.name} 上传成功（Mock 模式）`);
    },
    [currentKbId, apiAvailable],
  );

  // ===== 拖拽调整宽度 =====
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const newWidth = window.innerWidth - e.clientX;
      setSidebarWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, newWidth)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  return (
    <div style={{ display: 'flex', gap: 0, minHeight: '100vh' }}>

      {/* ===== 左侧：对话历史侧边栏 ===== */}
      <ChatHistorySidebar />

      {/* ===== 左侧主体 ===== */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: '100vh',
      }}>
        {/* 顶部欢迎区 */}
        <div style={{ padding: '20px 0 12px' }}>
          <Title level={2}>欢迎使用 PK Repository</Title>
          <Text type="secondary">个人知识库管理系统 — 文档导入 → AI 构建图谱 → 智能问答</Text>
        </div>

        <div style={{ borderTop: '1px solid var(--color-border)' }} />

        <ChatPanel />
      </div>

      {/* ===== 拖拽手柄 + 右侧边栏 ===== */}
      <div style={{ display: 'flex', gap: 0 }}>
        <div
          onMouseDown={onMouseDown}
          style={{
            width: 4,
            cursor: 'col-resize',
            background: 'transparent',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--color-border-secondary)'; }}
          onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'transparent'; }}
        />

        <Sidebar kbs={kbs} docs={docs} sidebarWidth={sidebarWidth} onDocDrop={handleDocDrop} />
      </div>

    </div>
  );
}

export default Zhuye;
