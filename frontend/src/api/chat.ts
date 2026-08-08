/**
 * AI 对话 API — SSE 流式请求
 *
 * Phase 2：使用 fetch + ReadableStream 解析 SSE（支持 POST 传参）。
 * 后端返回 SSE 格式：
 *   data: {"type":"token",   "content":"..."}
 *   data: {"type":"source",  "sources":[...]}
 *   data: {"type":"done",    "message_id":"...", "follow_up_questions":["..."]}
 *   data: {"type":"error",   "content":"错误描述"}
 */

import type { ChatEvent } from '../types';

export interface ChatRequest {
  question: string;
  context_type: 'doc' | 'kb' | 'global';
  kb_id?: string;
  doc_id?: string;
  page?: number;
}

/**
 * SSE 流式对话 — 返回 AsyncGenerator，逐条产出 ChatEvent
 *
 * 使用方式：
 *   for await (const event of streamChat({ question: '...', context_type: 'kb', kb_id: '...' })) {
 *     if (event.type === 'token') onToken(event.content);
 *     if (event.type === 'done')  onDone(event.message_id);
 *   }
 */
export async function* streamChat(req: ChatRequest): AsyncGenerator<ChatEvent> {
  let res: Response;

  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
  } catch {
    yield { type: 'error', content: '网络请求失败，请检查后端是否已启动' };
    return;
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    yield { type: 'error', content: body.detail || `请求失败 (${res.status})` };
    return;
  }

  if (!res.body) {
    yield { type: 'error', content: '响应体为空' };
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE 事件以 \n\n 分隔
      const parts = buffer.split('\n\n');
      // 最后一个可能不完整，留到下次
      buffer = parts.pop() || '';

      for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;

        // 解析 "data: {...}" 行
        for (const line of trimmed.split('\n')) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.slice(6);
            try {
              const event: ChatEvent = JSON.parse(jsonStr);
              yield event;

              // done 或 error 后停止读取
              if (event.type === 'done' || event.type === 'error') {
                reader.cancel();
                return;
              }
            } catch {
              // 跳过无法解析的行
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ========== Mock 兜底 ==========
// 当后端未就绪时，模拟 SSE 流式输出，便于前端独立开发

const MOCK_REPLY = [
  '好的，',
  '以下是',
  '关于',
  '该主题',
  '的分析：',
  '',
  '\n\n## 核心概念',
  '',
  '\n\n- **',
  '知识点',
  ' A**：',
  '这是',
  '基础概念，',
  '需要优先',
  '掌握',
  '\n- **知识点 B**：建立在 A 之上，涉及更深层的原理',
  '\n- **知识点 C**：与前两者形成对比，实际应用中需权衡',
  '',
  '\n\n### 关键代码示例',
  '',
  '\n\n```python\n',
  'def hello_world():\n',
  '    print("Hello, PK Repository!")\n',
  '    return True\n',
  '```',
  '',
  '\n\n> 💡 **提示**：当前为 Mock 模式。Phase 2 后端就绪后将展示基于知识库的动态回复。',
  '',
  '\n\n| 阶段 | 核心任务 | 状态 |',
  '\n|------|---------|------|',
  '\n| Phase 1 | 数据层打通 | ✅ 已完成 |',
  '\n| Phase 2 | RAG 核心链路 | 🚧 进行中 |',
  '\n| Phase 3 | 知识图谱可视化 | ⏳ 待开始 |',
];

/**
 * Mock SSE 流式对话 — 逐 token 模拟输出，行为与真实 API 一致
 */
export async function* mockStreamChat(
  _req: ChatRequest,
): AsyncGenerator<ChatEvent> {
  void _req; // Mock 模式下忽略入参，保持与 streamChat 同签名
  for (const token of MOCK_REPLY) {
    yield { type: 'token', content: token };
    // 模拟打字延迟
    await new Promise((r) => setTimeout(r, 30 + Math.random() * 30));
  }

  // 模拟来源引用
  yield {
    type: 'source',
    sources: [
      {
        doc_name: '卷积神经网络综述.pdf',
        doc_id: 'doc_001',
        page: 3,
        chunk_text: 'ReLU（Rectified Linear Unit）是当前 CNN 中最常用的激活函数，其定义为 f(x) = max(0, x)。ReLU 计算简单、梯度传播高效。然而 ReLU 在 x < 0 时梯度恒为零，可能导致部分神经元永久失活，这一现象被称为"死亡 ReLU"问题。',
        score: 0.92,
      },
      {
        doc_name: '反向传播推导过程.docx',
        doc_id: 'doc_002',
        page: 2,
        chunk_text: '反向传播从输出层开始，逐层向前计算。第一步：计算输出层误差。δ(L) = ∇a(L) L ⊙ f\'(z(L))，其中 ⊙ 表示逐元素乘法（Hadamard 积）。',
        score: 0.85,
      },
      {
        doc_name: '深度学习入门笔记.md',
        doc_id: 'doc_md',
        page: 3,
        chunk_text: '池化层（Pooling Layer）对特征图进行下采样，主要目的包括：降维——减少特征图的空间尺寸，降低后续层的计算量；不变性——提供一定的平移不变性。',
        score: 0.78,
      },
      {
        doc_name: '激活函数对比.pptx',
        doc_id: 'doc_003',
        page: 12,
        chunk_text: 'GELU 在 Transformer 架构中得到了广泛应用，其平滑的非线性特性在某些任务上优于 ReLU。',
        score: 0.71,
      },
    ],
  };

  yield {
    type: 'done',
    message_id: `mock_${Date.now()}`,
    follow_up_questions: ['这个概念还有哪些延伸？', '能给我一个实际应用的例子吗？', '相关的知识点有哪些？'],
  };
}
