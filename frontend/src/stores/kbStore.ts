import { create } from 'zustand';
import type { KB, Doc } from '../types';

interface KBState {
  /** 知识库列表 */
  kbs: KB[];
  /** 列表是否加载中 */
  loading: boolean;
  /** 当前选中的知识库 ID（Phase 2 起用于 API 调用的 kb_id 参数） */
  currentKbId: string | null;
  /** 当前知识库的文档列表（缓存，多页面共享，避免重复请求） */
  docs: Doc[];
  /** 已缓存的文档所属 kb_id（切换知识库时失效） */
  docsKbId: string | null;

  setKBs: (kbs: KB[]) => void;
  addKB: (kb: KB) => void;
  removeKB: (id: string) => void;
  setCurrentKbId: (id: string | null) => void;
  /** 设置文档列表缓存 */
  setDocs: (docs: Doc[], kbId: string) => void;
  /** 若当前知识库的文档未缓存则拉取（缓存命中直接返回） */
  fetchDocsIfNeeded: (kbId: string) => Promise<Doc[]>;
}

/** 知识库列表 & 当前选中状态 */
export const useKBStore = create<KBState>((set, get) => ({
  kbs: [],
  loading: false,
  currentKbId: null,
  docs: [],
  docsKbId: null,

  setKBs: (kbs) => set({ kbs }),

  addKB: (kb) => set((state) => ({ kbs: [...state.kbs, kb] })),

  removeKB: (id) => set((state) => ({ kbs: state.kbs.filter((kb) => kb.id !== id) })),

  setCurrentKbId: (id) => set({ currentKbId: id }),

  setDocs: (docs, kbId) => set({ docs, docsKbId: kbId }),

  fetchDocsIfNeeded: async (kbId) => {
    const { docs, docsKbId } = get();
    // 缓存命中（同一知识库）直接返回
    if (docsKbId === kbId && docs.length > 0) {
      return docs;
    }
    // 未缓存 → 拉取并缓存
    const { getDocuments } = await import('../api');
    const list = await getDocuments(kbId);
    set({ docs: list, docsKbId: kbId });
    return list;
  },
}));
