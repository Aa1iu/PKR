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

/** 文档内容分页 */
export interface DocContent {
  pages: { page_num: number; text: string }[];
  total_pages: number;
}

/** GET /api/kbs/{kb_id}/docs/{doc_id}/content?page=N — 获取文档分页内容 */
export async function getDocumentContent(
  kbId: string,
  docId: string,
  page: number = 1,
): Promise<DocContent> {
  return request<DocContent>(`/kbs/${kbId}/docs/${docId}/content?page=${page}`);
}

/** 获取原始文件流 URL（供 PDF iframe / DOCX mammoth 下载用） */
export function getDocumentFileUrl(kbId: string, docId: string): string {
  return `/api/kbs/${kbId}/docs/${docId}/file`;
}

/** 获取文档页图片 URL（PPTX 画廊用） */
export function getPageImageUrl(kbId: string, docId: string, page: number): string {
  return `/api/kbs/${kbId}/docs/${docId}/page-image?page=${page}`;
}
