import { create } from 'zustand';

type ThemeMode = 'light' | 'dark';

const THEME_KEY = 'pk-theme';
const BG_IMAGE_KEY = 'pk-bg-image';

/** 从 localStorage 读取持久化的主题偏好 */
function getStoredTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // localStorage 不可用时忽略
  }
  return 'light';
}

/** 从 localStorage 读取持久化的背景图片 */
function getStoredBgImage(): string | null {
  try {
    return localStorage.getItem(BG_IMAGE_KEY);
  } catch {
    return null;
  }
}

/** 同步 data-theme 属性到 <html> */
function applyTheme(mode: ThemeMode) {
  document.documentElement.setAttribute('data-theme', mode);
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    // 忽略
  }
}

// 初始化：页面加载时立即应用（避免闪烁）
applyTheme(getStoredTheme());

interface ThemeState {
  mode: ThemeMode;
  backgroundImage: string | null;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setBackgroundImage: (url: string | null) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: getStoredTheme(),
  backgroundImage: getStoredBgImage(),

  setTheme: (mode) => {
    applyTheme(mode);
    set({ mode });
  },

  toggleTheme: () => {
    const next = get().mode === 'light' ? 'dark' : 'light';
    applyTheme(next);
    set({ mode: next });
  },

  setBackgroundImage: (url) => {
    try {
      if (url) {
        localStorage.setItem(BG_IMAGE_KEY, url);
      } else {
        localStorage.removeItem(BG_IMAGE_KEY);
      }
    } catch {
      // 忽略
    }
    set({ backgroundImage: url });
  },
}));

