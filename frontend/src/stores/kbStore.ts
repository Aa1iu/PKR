import { create } from 'zustand';
import type { KB } from '../types';

interface KBState {
  /** 知识库列表 */
  kbs: KB[];
  /** 列表是否加载中 */
  loading: boolean;
  /** 当前选中的知识库 ID（Phase 2 起用于 API 调用的 kb_id 参数） */
  currentKbId: string | null;

  setKBs: (kbs: KB[]) => void;
  addKB: (kb: KB) => void;
  removeKB: (id: string) => void;
  setCurrentKbId: (id: string | null) => void;
}

/** 知识库列表 & 当前选中状态 — Phase 2 切换真实 API */
export const useKBStore = create<KBState>((set) => ({
  kbs: [],
  loading: false,
  currentKbId: null,

  setKBs: (kbs) => set({ kbs }),

  addKB: (kb) => set((state) => ({ kbs: [...state.kbs, kb] })),

  removeKB: (id) => set((state) => ({ kbs: state.kbs.filter((kb) => kb.id !== id) })),

  setCurrentKbId: (id) => set({ currentKbId: id }),
}));
