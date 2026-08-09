import { create } from 'zustand';
import type { GraphNode, GraphEdge } from '../types';
import { getGraph, MOCK_GRAPH } from '../api';

interface GraphState {
  /** 图谱节点 */
  nodes: GraphNode[];
  /** 图谱边 */
  edges: GraphEdge[];
  /** 是否加载中 */
  loading: boolean;
  /** 错误信息（null = 无错误） */
  error: string | null;
  /** null=未请求；true=API 返回非空图谱；false=API 失败或返回空 → 走 Mock */
  apiAvailable: boolean | null;

  fetchGraph: (kbId: string | null) => Promise<void>;
}

/** 知识图谱数据 + 加载状态 — Phase 3（8/4）基础渲染 */
export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  edges: [],
  loading: false,
  error: null,
  apiAvailable: null,

  fetchGraph: async (kbId) => {
    set({ loading: true, error: null });

    // 无选中知识库 → 直接 Mock 兜底
    if (!kbId) {
      set({ nodes: MOCK_GRAPH.nodes, edges: MOCK_GRAPH.edges, apiAvailable: false, loading: false });
      return;
    }

    try {
      const data = await getGraph(kbId);
      if (data.nodes.length > 0) {
        set({ nodes: data.nodes, edges: data.edges, apiAvailable: true });
      } else {
        // 该 KB 还没有图谱数据（未导入文档或未运行分析）
        set({ nodes: [], edges: [], apiAvailable: true, error: '该知识库还没有图谱数据，请先导入文档并运行分析' });
      }
    } catch {
      set({ nodes: [], edges: [], apiAvailable: false, error: '无法加载图谱数据，请确认后端已启动' });
    } finally {
      set({ loading: false });
    }
  },
}));
