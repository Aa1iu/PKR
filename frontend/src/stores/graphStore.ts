import { create } from 'zustand';
import type { GraphNode, GraphEdge } from '../types';
import { getGraph } from '../api';

interface GraphState {
  /** 图谱节点 */
  nodes: GraphNode[];
  /** 图谱边 */
  edges: GraphEdge[];
  /** 是否加载中 */
  loading: boolean;
  /** 错误信息（null = 无错误） */
  error: string | null;

  fetchGraph: (kbId: string | null) => Promise<void>;
}

/** 知识图谱数据 + 加载状态 */
export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  edges: [],
  loading: false,
  error: null,

  fetchGraph: async (kbId) => {
    if (!kbId) {
      set({ loading: false, error: '请先选择知识库' });
      return;
    }

    set({ loading: true, error: null });

    try {
      const data = await getGraph(kbId);
      set({
        nodes: data.nodes,
        edges: data.edges,
      });
    } catch {
      set({ error: '无法加载图谱数据，请确认后端已启动' });
    } finally {
      set({ loading: false });
    }
  },
}));
