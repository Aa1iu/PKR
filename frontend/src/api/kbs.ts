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
