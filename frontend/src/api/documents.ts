/**
 * 文档 API
 */

import { request, uploadRequest } from './client';
import type { Doc } from '../types';

/** GET /api/kbs/{kb_id}/docs — 获取文档列表 */
export async function getDocuments(kbId: string): Promise<Doc[]> {
  const data = await request<{ docs: Doc[] }>(`/kbs/${kbId}/docs`);
  return data.docs;
}

/** POST /api/kbs/{kb_id}/docs/upload — 上传文档（FormData） */
export async function uploadDocument(
  kbId: string,
  file: File,
): Promise<Doc> {
  const formData = new FormData();
  formData.append('file', file);
  return uploadRequest<Doc>(`/kbs/${kbId}/docs/upload`, formData);
}

/** DELETE /api/kbs/{kb_id}/docs/{doc_id} — 删除文档（同步清理向量库） */
export async function deleteDocument(
  kbId: string,
  docId: string,
): Promise<{ success: boolean }> {
  return request(`/kbs/${kbId}/docs/${docId}`, { method: 'DELETE' });
}
