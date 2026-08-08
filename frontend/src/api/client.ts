/**
 * API 客户端基础层 — 统一 fetch 封装、错误处理
 *
 * Phase 2 开始逐步替换各组件内联的 Mock 数据。
 * 所有请求的 base URL 由 Vite 开发代理处理（/api → localhost:8000）。
 */

const BASE = '/api';

/** API 错误类 — 附带服务端返回的 detail 信息 */
export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(`[${status}] ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

/**
 * 通用 JSON 请求
 *
 * @param url     相对路径，如 `/kbs`、`/kbs/{id}/docs`
 * @param options fetch 配置（method、body、headers 等）
 * @returns       解析后的 JSON 响应（泛型 T）
 */
export async function request<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${url}`, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      ...options,
    });
  } catch {
    throw new ApiError(0, '网络请求失败，请检查后端是否已启动');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail || res.statusText);
  }

  // 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

/**
 * FormData 上传请求（不设 Content-Type，浏览器自动生成 multipart boundary）
 */
export async function uploadRequest<T>(
  url: string,
  formData: FormData,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${url}`, {
      method: 'POST',
      body: formData,
    });
  } catch {
    throw new ApiError(0, '上传请求失败，请检查后端是否已启动');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, body.detail || res.statusText);
  }

  return res.json();
}
