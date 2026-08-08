import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Tooltip, Modal, Input, message, Image } from 'antd';
import { BookOutlined, FileTextOutlined, SunOutlined, MoonOutlined, SettingOutlined, ApartmentOutlined } from '@ant-design/icons';
import type { KB, Doc } from '../types';
import SidebarKBList from './SidebarKBList';
import SidebarDocList from './SidebarDocList';
import { useThemeStore } from '../stores/themeStore';

interface Props {
  kbs: KB[];
  docs: Doc[];
  sidebarWidth: number;
  onDocDrop?: (file: File) => void;
}

/** 侧边栏 — 右侧边栏按钮切换列表，无列表打开时不占空间 */
function Sidebar({ kbs, docs, sidebarWidth, onDocDrop }: Props) {
  const [openSection, setOpenSection] = useState<'kb' | 'doc' | null>('kb');
  const isOpen = openSection !== null;
  const navigate = useNavigate();
  const themeMode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const backgroundImage = useThemeStore((s) => s.backgroundImage);
  const setBackgroundImage = useThemeStore((s) => s.setBackgroundImage);

  // ---- 背景图设置 Modal 状态 ----
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bgUrlInput, setBgUrlInput] = useState(backgroundImage || '');

  /** 打开设置时同步当前背景图到输入框 */
  const openSettings = () => {
    setBgUrlInput(backgroundImage || '');
    setSettingsOpen(true);
  };

  /** 校验 & 应用背景图 */
  const handleApplyBg = () => {
    const url = bgUrlInput.trim();
    if (!url) {
      setBackgroundImage(null);
      setSettingsOpen(false);
      return;
    }
    if (!/^(https?:\/\/|\/|data:)/i.test(url)) {
      message.error('请输入有效的图片 URL（支持 https://、/本地路径、data: 格式）');
      return;
    }
    setBackgroundImage(url);
    message.success('背景图已应用');
    setSettingsOpen(false);
  };

  /** 清除背景图 */
  const handleClearBg = () => {
    setBackgroundImage(null);
    setBgUrlInput('');
    message.success('背景图已清除');
    setSettingsOpen(false);
  };

  /** 点击按钮：已打开 → 收起；未打开 → 切换到此列表 */
  const handleToggle = (section: 'kb' | 'doc') => {
    setOpenSection(openSection === section ? null : section);
  };

  return (
    <div style={{ display: 'flex', gap: 0 }}>
      {/* ===== 列表面板 — 仅当有分区打开时渲染 ===== */}
      {isOpen && (
        <div
          style={{
            width: sidebarWidth,
            maxHeight: '100vh',
            borderLeft: '1px solid var(--color-border)',
            paddingLeft: 24,
            paddingRight: 24,
            overflow: 'auto',
          }}
        >
          {openSection === 'kb' && (
            <SidebarKBList kbs={kbs} sidebarWidth={sidebarWidth} />
          )}
          {openSection === 'doc' && (
            <SidebarDocList docs={docs} sidebarWidth={sidebarWidth} onDocDrop={onDocDrop} />
          )}
        </div>
      )}

      {/* ===== 切换按钮条 — 始终在右侧显示 ===== */}
      <div
        style={{
          width: 40,
          borderLeft: isOpen ? undefined : '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '10px 0',
          gap: 8,
        }}
      >
        <Tooltip
          title={openSection === 'kb' ? '收起知识库列表' : '知识库列表'}
          placement="left"
        >
          <Button
            type={openSection === 'kb' ? 'primary' : 'text'}
            size="small"
            icon={<BookOutlined />}
            onClick={() => handleToggle('kb')}
          />
        </Tooltip>

        <Tooltip
          title={openSection === 'doc' ? '收起文档列表' : '文档列表'}
          placement="left"
        >
          <Button
            type={openSection === 'doc' ? 'primary' : 'text'}
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => handleToggle('doc')}
          />
        </Tooltip>

        {/* 知识图谱入口（跳转 /tupu） */}
        <Tooltip title="知识图谱" placement="left">
          <Button
            type="text"
            size="small"
            icon={<ApartmentOutlined />}
            onClick={() => navigate('/tupu')}
          />
        </Tooltip>

        {/* 分割线 */}
        <div style={{ width: 20, borderTop: '1px solid var(--color-border)', margin: '4px 0' }} />

        {/* 主题切换 */}
        <Tooltip title={themeMode === 'light' ? '切换暗色模式' : '切换亮色模式'} placement="left">
          <Button
            type="text"
            size="small"
            icon={themeMode === 'light' ? <MoonOutlined /> : <SunOutlined />}
            onClick={toggleTheme}
          />
        </Tooltip>

        {/* 背景图设置 */}
        <Tooltip title="背景图设置" placement="left">
          <Button
            type="text"
            size="small"
            icon={<SettingOutlined />}
            onClick={openSettings}
          />
        </Tooltip>
      </div>

      {/* ===== 背景图设置 Modal ===== */}
      <Modal
        title="背景图设置"
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        onOk={handleApplyBg}
        okText="应用"
        cancelText="取消"
        width={480}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>图片 URL</div>
            <Input
              placeholder="输入图片 URL，或把图片放到 public/ 后用 /xxx.png 引用"
              value={bgUrlInput}
              onChange={(e) => setBgUrlInput(e.target.value)}
              onPressEnter={handleApplyBg}
              allowClear
            />
          </div>

          {/* 预览 */}
          {(bgUrlInput || backgroundImage) && (
            <div>
              <div style={{ marginBottom: 8, fontWeight: 500 }}>预览</div>
              <Image
                src={bgUrlInput || backgroundImage || ''}
                alt="背景图预览"
                style={{ maxHeight: 200, borderRadius: 8, objectFit: 'cover' }}
                fallback="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
              />
            </div>
          )}

          {/* 清除按钮 */}
          {backgroundImage && (
            <Button danger onClick={handleClearBg} style={{ alignSelf: 'flex-start' }}>
              清除背景图
            </Button>
          )}
        </div>
      </Modal>
    </div>
  );
}

export default Sidebar;
