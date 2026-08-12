/**
 * 知识库 API
 */

import { request } from './client';
import type { KB } from '../types';

/** GET /api/kbs — 获取知识库列表 */
export async function getKBs(): Promise<KB[]> {
  const data = await request<{ kbs: KB[] }>('/kbs');
  return data.kbs;
}
// 需要新增的：

/** POST /api/kbs — 创建知识库 */
export async function createKB(body: { name: string; description?: string; tags?: string[] }): Promise<KB> {
  return request<KB>('/kbs', { method: 'POST', body: JSON.stringify(body) });
}

/** DELETE /api/kbs/{kb_id} — 删除知识库 */
export async function deleteKB(kbId: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/kbs/${kbId}`, { method: 'DELETE' });
}

/** PUT /api/kbs/{kb_id} — 更新知识库（name/description/tags 均可选） */
export async function updateKB(
  kbId: string,
  body: { name?: string; description?: string; tags?: string[] },
): Promise<KB> {
  return request<KB>(`/kbs/${kbId}`, { method: 'PUT', body: JSON.stringify(body) });
}
