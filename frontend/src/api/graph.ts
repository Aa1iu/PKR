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

/** POST /api/kbs/{kb_id}/analyze — 触发图谱分析 */
export async function triggerAnalyze(kbId: string): Promise<{ kb_id: string; status: string }> {
  return request(`/kbs/${kbId}/analyze`, { method: 'POST', body: '{}' });
}

/** GET /api/kbs/{kb_id}/analyze/status — 查询分析状态 */
export async function getAnalyzeStatus(kbId: string): Promise<{
  kb_id: string;
  status: string;
  progress: number;
  current_step: string;
  error: string | null;
}> {
  return request(`/kbs/${kbId}/analyze/status`);
}
