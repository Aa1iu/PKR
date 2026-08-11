/**
 * 知识图谱 API
 */

import { request } from './client';
import type { GraphNode, GraphEdge } from '../types';

/** 图谱数据（API 响应形状） */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** GET /api/kbs/{kb_id}/graph — 获取知识图谱 */
export async function getGraph(kbId: string): Promise<GraphData> {
  const data = await request<GraphData>(`/kbs/${kbId}/graph`);
  return data;
}
