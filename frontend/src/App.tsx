import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import KBList from './pages/KBList';
import KBDetail from './pages/KBDetail';
import DocReader from './pages/DocReader';
import GraphPage from './pages/GraphPage';
import Zhuye from './pages/zhuye';
import FloatChat from './components/FloatChat';
import { useThemeStore } from './stores/themeStore';
import NotFound from './pages/NotFound';
function App() {
  const mode = useThemeStore((s) => s.mode);
  const backgroundImage = useThemeStore((s) => s.backgroundImage);

  // 同步 data-theme 属性到 <html>（store 初始化时已设置，此处确保切换时跟随）
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  return (
    <ConfigProvider
      theme={{
        algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
      }}
    >
      <div
        style={{
          padding: 24,
          minHeight: '100vh',
          background: backgroundImage
            ? `var(--color-bg) url(${backgroundImage}) center / cover no-repeat fixed`
            : 'var(--color-bg)',
        }}
      >
        <Routes>
          <Route path="/" element={<Zhuye />} />
          <Route path="/zhishiku" element={<KBList />} />
          <Route path="/wendang/:kbId/:docId" element={<DocReader />} />
          <Route path="/wendang" element={<KBDetail />} />
          <Route path="/tupu" element={<GraphPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>

        {/* Phase 2：全局浮动 AI 对话窗口 */}
        <FloatChat />
      </div>
    </ConfigProvider>
  );
}

export default App;
