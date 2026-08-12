/**
 * API 层统一导出
 *
 * 使用方式：
 *   import { getKBs, getDocuments, uploadDocument, deleteDocument } from '../api';
 */

export { ApiError } from './client';
export { getKBs, createKB, deleteKB, updateKB } from './kbs';
export { getDocuments, uploadDocument, deleteDocument, getDocumentContent, getDocumentFileUrl, getPageImageUrl } from './documents';
export type { DocContent } from './documents';
export { getGraph } from './graph';
