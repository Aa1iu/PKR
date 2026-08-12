import { useState, useRef, useCallback, useEffect } from 'react';
import { Typography, message } from 'antd';
import type { KB, Doc } from '../types';
import { validateFileType, uploadDocToKB } from '../utils/upload';
import { getDocuments } from '../api';
import { useKBStore } from '../stores/kbStore';
import ChatPanel from '../components/ChatPanel';
import ChatHistorySidebar from '../components/ChatHistorySidebar';
import Sidebar from '../components/Sidebar';

const { Title, Text } = Typography;

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
  const [kbs, setLocalKbs] = useState<KB[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [loading, setLoading] = useState(true);
  const dragging = useRef(false);

  // ===== 初始化：同步 store + 尝试加载 KB 列表和文档 =====
  useEffect(() => {
    let cancelled = false;

    async function init() {
      // 如果 store 中已有 KBS（比如从 KBList 页回来），直接用
      if (storeKBs.length > 0) {
        setLocalKbs(storeKBs);
        setLoading(false);
        return;
      }

      try {
        const { getKBs } = await import('../api');
        const list = await getKBs();
        if (!cancelled) {
          setLocalKbs(list);
          setKBs(list);
          if (list.length > 0 && !currentKbId) {
            setCurrentKbId(list[0].id);
          }
        }
      } catch {
        // 静默失败，侧边栏显示空状态
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== currentKbId 变化时加载对应文档列表（走 kbStore 缓存） =====
  useEffect(() => {
    if (!currentKbId) return;

    let cancelled = false;

    async function loadDocs() {
      try {
        const { fetchDocsIfNeeded } = useKBStore.getState();
        const list = await fetchDocsIfNeeded(currentKbId!);
        if (!cancelled) {
          setDocs(list);
        }
      } catch {
        // 静默失败
      }
    }

    loadDocs();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKbId]);

  // ===== 文档拖拽上传回调 =====
  const handleDocDrop = useCallback(
    async (file: File) => {
      if (!validateFileType(file)) return;

      if (!currentKbId) {
        message.warning('请先在侧边栏选择知识库');
        return;
      }

      const doc = await uploadDocToKB(currentKbId, file);
      if (doc) {
        setDocs((prev) => [doc, ...prev]);
        // 同步更新 store 缓存（图谱页等共享）
        const { docs, setDocs: setStoreDocs } = useKBStore.getState();
        setStoreDocs([doc, ...docs], currentKbId);
      }
    },
    [currentKbId],
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
        <ChatPanel kbId={currentKbId} />
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
