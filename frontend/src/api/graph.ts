/**
 * 知识图谱 API
 *
 * Phase 3（8/4）：图谱基础渲染。后端 GET /graph 为 stub（返回空数组），
 * 8/8 Mock→真实数据切换前，前端以 MOCK_GRAPH 兜底。
 */

import { request } from './client';
import type { GraphNode, GraphEdge } from '../types';

/** 图谱数据（API 响应形状） */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** GET /api/kbs/{kb_id}/graph — 获取知识图谱（Phase 3 后端实现；当前返回空） */
export async function getGraph(kbId: string): Promise<GraphData> {
  const data = await request<GraphData>(`/kbs/${kbId}/graph`);
  return data;
}

/** 文档名映射：mock doc_refs 由 string[] 还原为对象（对齐 GraphNode.doc_refs 类型） */
const DOC_NAME: Record<string, string> = {
  doc_001: '机器学习面试题汇总.pdf',
  doc_002: '深度学习基础概念.docx',
  doc_003: '吴恩达课程笔记.txt',
};

/** mock 数据中 doc_refs 是 string[]，转为前端类型要求的 {doc_id, filename, page} */
const toRefs = (ids: string[]) =>
  ids.map((doc_id) => ({ doc_id, filename: DOC_NAME[doc_id] ?? doc_id, page: 0 }));

/**
 * Mock 兜底数据 — 对齐 mock/kb_kb_demo_001_graph.json（8 节点 + 8 边）
 * 8/4 基础渲染：仅使用 id/name/type/degree + source/target/relation；
 * definition/doc_refs 供后续浮窗（8/8）使用。
 */
export const MOCK_GRAPH: GraphData = {
  nodes: [
    { id: 'n1', name: '监督学习', definition: '利用有标签数据训练模型', type: '基础概念', degree: 4, doc_refs: toRefs(['doc_001', 'doc_003']) },
    { id: 'n2', name: '无监督学习', definition: '从无标签数据中发现模式', type: '基础概念', degree: 3, doc_refs: toRefs(['doc_001']) },
    { id: 'n3', name: '过拟合', definition: '模型在训练集表现好但泛化能力差', type: '基础概念', degree: 3, doc_refs: toRefs(['doc_001', 'doc_002']) },
    { id: 'n4', name: '正则化', definition: '防止过拟合的技术手段', type: '技术方法', degree: 2, doc_refs: toRefs(['doc_002']) },
    { id: 'n5', name: '梯度下降', definition: '通过迭代更新参数最小化损失函数', type: '技术方法', degree: 4, doc_refs: toRefs(['doc_002', 'doc_003']) },
    { id: 'n6', name: '神经网络', definition: '模拟人脑神经元连接的计算模型', type: '基础概念', degree: 3, doc_refs: toRefs(['doc_002']) },
    { id: 'n7', name: '反向传播', definition: '计算梯度的高效算法', type: '技术方法', degree: 2, doc_refs: toRefs(['doc_002', 'doc_003']) },
    { id: 'n8', name: '偏差-方差权衡', definition: '模型复杂度与泛化能力的平衡', type: '基础概念', degree: 2, doc_refs: toRefs(['doc_001']) },
  ],
  edges: [
    { source: 'n1', target: 'n3', relation: '常见问题', description: '监督学习模型容易出现过拟合' },
    { source: 'n4', target: 'n3', relation: '解决', description: '正则化用于缓解过拟合' },
    { source: 'n5', target: 'n1', relation: '用于', description: '梯度下降是监督学习的基本优化方法' },
    { source: 'n6', target: 'n1', relation: '属于', description: '神经网络是一种监督学习模型' },
    { source: 'n7', target: 'n6', relation: '训练', description: '反向传播用于训练神经网络' },
    { source: 'n7', target: 'n5', relation: '依赖', description: '反向传播基于梯度下降' },
    { source: 'n3', target: 'n8', relation: '相关', description: '过拟合是偏差-方差权衡的一极' },
    { source: 'n2', target: 'n1', relation: '对比', description: '无监督学习与监督学习是两大范式' },
  ],
};
