/**
 * API 层统一导出
 *
 * 使用方式：
 *   import { getKBs, getDocuments, uploadDocument, deleteDocument } from '../api';
 */

export { ApiError } from './client';
export { getKBs, createKB, deleteKB, updateKB, searchKb } from './kbs';
export type { FullTextSearchResult } from './kbs';
export { getDocuments, getDocumentDetail, uploadDocument, deleteDocument, renameDocument, getDocumentContent, getDocumentFileUrl, getPageImageUrl } from './documents';
export type { DocContent } from './documents';
export { getGraph, triggerAnalyze, getAnalyzeStatus } from './graph';
