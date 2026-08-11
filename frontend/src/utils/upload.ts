import { message } from 'antd';
import type { Doc } from '../types';
import { uploadDocument as apiUpload } from '../api';

/** 允许上传的文件扩展名 */
const ALLOWED_EXTS = ['pdf', 'docx', 'pptx', 'md', 'txt'];

/**
 * 校验文件类型是否允许上传
 * @returns true = 通过，false = 已弹错误提示并拒绝
 */
export function validateFileType(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTS.includes(ext)) {
    message.error(`不支持的文件类型：.${ext}（仅支持 PDF / DOCX / PPTX / MD / TXT）`);
    return false;
  }
  return true;
}

/**
 * 上传文档到知识库（Phase 2 真实 API）
 *
 * @param kbId  目标知识库 ID
 * @param file  用户选择的文件
 * @returns      后端返回的 Doc 文档记录；API 不可用时返回 null
 */
export async function uploadDocToKB(kbId: string, file: File): Promise<Doc | null> {
  try {
    const doc = await apiUpload(kbId, file);
    message.success(`${file.name} 上传成功`);
    return doc;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : '上传失败';
    message.error(msg);
    return null;
  }
}

