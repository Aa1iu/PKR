import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  zoom,
  drag,
  select,
  type Simulation,
  type Selection,
  type ZoomTransform,
} from 'd3';
import { FileTextOutlined } from '@ant-design/icons';
import type { GraphNode, GraphEdge } from '../types';
import { useKBStore } from '../stores/kbStore';

/**
 * D3 力导向图 — Phase 3 图谱可视化
 *
 * 8/4 基础渲染：节点圆圈 + 文字标签 + 边线条 + d3-force 布局。
 * 8/5 增强：
 *   - 节点按 type 着色（TYPE_COLOR + 顶部图例）
 *   - 节点大小 ∝ degree（RADIUS_MIN..RADIUS_MAX 线性映射）
 *   - 点击节点高亮自身 + 邻居（其余节点/边变暗，点空白清除）
 * 8/6 增强：滚轮缩放 + 空白处拖拽平移（d3-zoom）+ 节点拖拽（d3-drag，resize 后恢复视口）
 * 8/7 增强：点击节点弹出详情浮窗（name/type/definition/来源 doc_refs）；再点同节点或空白→关闭。
 * 8/8 增强：浮窗内 doc_refs 可点击 → 跳转 /wendang/:docId + 定位到对应页。
 * 8/9 增强：加载动画 — 仿真收敛期 overlay（脉冲圆点） + 节点/边渐显（opacity 随 alpha 衰减 fade-in）。
 */

const RADIUS_MIN = 12; // 最小节点半径（degree 最小时）
const RADIUS_MAX = 28; // 最大节点半径（degree 最大时）
const CHARGE = -300; // 节点间斥力
const LINK_DISTANCE = 120; // 边目标长度
const COLLIDE_LABEL_PAD = 26; // 碰撞半径额外空间（容纳文字标签，防重叠）
const HIGHLIGHT_DIM_OPACITY = 0.12; // 非关联节点/边变暗透明度
const HIGHLIGHT_STROKE = '#faad14'; // 选中节点描边色（金色，亮/暗主题均可见）
const MIN_SIZE = 300;
const SIM_READY_ALPHA = 0.15; // 仿真 alpha 低于此值视为布局稳定，触发渐显完成

/** 节点 type → 颜色（AntD 色板，亮/暗背景均清晰） */
const TYPE_COLOR: Record<GraphNode['type'], string> = {
  基础概念: '#4096ff',
  技术方法: '#52c41a',
  工具框架: '#722ed1',
  应用场景: '#fa8c16',
  其他: '#8c8c8c',
};

/** d3 会在 datum 上原地写入 x/y/vx/vy/fx/fy */
type SimNode = GraphNode & {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
};

/** forceLink 运行时把 source/target 原地改写为节点对象引用
 * （Omit 掉 GraphEdge 的 source/target 约束，避免与 string 求交集）
 */
type SimEdge = Omit<GraphEdge, 'source' | 'target'> & {
  source: SimNode | string;
  target: SimNode | string;
};

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** doc_id → filename 映射，供浮窗文档链接显示文件名 */
  docNames?: Record<string, string>;
}

function KnowledgeGraph({ nodes, edges, docNames = {} }: Props) {
  const navigate = useNavigate();
  const currentKbId = useKBStore((s) => s.currentKbId);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgAreaRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const nodeSelRef = useRef<Selection<SVGGElement, SimNode, SVGGElement, unknown> | null>(null);
  const linkSelRef = useRef<Selection<SVGLineElement, SimEdge, SVGGElement, unknown> | null>(null);
  const [size, setSize] = useState({ width: MIN_SIZE, height: MIN_SIZE });
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const zoomTransformRef = useRef<ZoomTransform | null>(null); // 视口，resize 重建后恢复
  const draggedRef = useRef(false); // 区分"点击高亮"与"拖拽"
  const [simReady, setSimReady] = useState(false); // 收敛 → overlay fade-out + 显示图谱
  const [overlayGone, setOverlayGone] = useState(false); // overlay CSS transition 完成后移除 DOM
  const [tooltip, setTooltip] = useState<{ node: SimNode; x: number; y: number } | null>(null);

  // 1) SVG 区域尺寸 → size（ResizeObserver，svg 用像素尺寸保证描边/文字清晰；
  //    图例横排在顶部占独立行，不计入画布高度）
  useEffect(() => {
    const el = svgAreaRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({
        width: Math.max(r.width, MIN_SIZE),
        height: Math.max(r.height, MIN_SIZE),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 2) 数据快照：复制 store 数据，避免 d3 原地写 x/y 污染全局状态
  const simNodes = useMemo<SimNode[]>(
    () => nodes.map((n) => ({ ...n }) as SimNode),
    [nodes],
  );
  const simEdges = useMemo<SimEdge[]>(
    () => edges.map((e) => ({ ...e }) as SimEdge),
    [edges],
  );

  // 3) 数据/尺寸变化时 render 阶段重置加载动画（同 DocReader 的 reset pattern）
  const [depsKey, setDepsKey] = useState(() => `${simNodes.length}|${simEdges.length}|${size.width}|${size.height}`);
  const newKey = `${simNodes.length}|${simEdges.length}|${size.width}|${size.height}`;
  if (newKey !== depsKey) {
    setDepsKey(newKey);
    setSimReady(false);
    setOverlayGone(false);
  }

  // 4) 高亮联动：读取 activeIdRef + d3 selection ref，不重建仿真即可改样式
  const applyHighlight = useCallback(() => {
    const active = activeIdRef.current;
    const nodesSel = nodeSelRef.current;
    const linksSel = linkSelRef.current;
    if (!nodesSel || !linksSel) return;

    const neighbors = new Set<string>();
    if (active !== null) {
      simEdges.forEach((e) => {
        const s = String(e.source);
        const t = String(e.target);
        if (s === active) neighbors.add(t);
        if (t === active) neighbors.add(s);
      });
    }

    nodesSel
      .attr('opacity', (d) =>
        active === null || d.id === active || neighbors.has(d.id) ? 1 : HIGHLIGHT_DIM_OPACITY,
      )
      .select('text')
      .attr('font-weight', (d) => (d.id === active ? 600 : 400));
    nodesSel
      .select('circle')
      .attr('stroke', (d) => (d.id === active ? HIGHLIGHT_STROKE : 'var(--color-bg)'))
      .attr('stroke-width', (d) => (d.id === active ? 3.5 : 2));

    linksSel.attr('opacity', (d) => {
      if (active === null) return 1;
      const s = (d.source as SimNode).id;
      const t = (d.target as SimNode).id;
      return s === active || t === active ? 1 : HIGHLIGHT_DIM_OPACITY;
    });
  }, [simEdges]);

  // 4) 仿真搭建 + DOM 渲染（StrictMode 安全：cleanup 停止仿真并清空 SVG）
  useEffect(() => {
    const svg = select(svgRef.current!);
    svg.selectAll('*').remove(); // 清空上次挂载残留

    // 局部 mutable flag：仿真收敛后置 true，tick 闭包直接捕获，无 stale closure
    let simReadyFlag = false;

    // 顶层分组：整个图谱挂在此组下，缩放/平移改变它的 transform
    const graph = svg.append('g').attr('class', 'graph');

    // 把边 source/target 字符串 → 节点对象引用（forceLink 要求）
    const byId = new Map(simNodes.map((n) => [n.id, n]));
    const links: SimEdge[] = simEdges.map((e) => ({
      ...e,
      source: byId.get(String(e.source)) ?? e.source,
      target: byId.get(String(e.target)) ?? e.target,
    }));

    // 节点大小 ∝ degree（线性映射到 [RADIUS_MIN, RADIUS_MAX]）
    const degs = simNodes.map((n) => n.degree);
    const degMin = degs.length ? Math.min(...degs) : 0;
    const degMax = degs.length ? Math.max(...degs) : 0;
    const radiusOf = (d: SimNode) => {
      const deg = Math.max(degMin, Math.min(degMax, d.degree));
      const t = degMax === degMin ? 0.5 : (deg - degMin) / (degMax - degMin);
      return RADIUS_MIN + t * (RADIUS_MAX - RADIUS_MIN);
    };

    const simulation: Simulation<SimNode, SimEdge | undefined> = forceSimulation<SimNode>(simNodes)
      .force('link', forceLink<SimNode, SimEdge>(links).id((d) => d.id).distance(LINK_DISTANCE))
      .force('charge', forceManyBody<SimNode>().strength(CHARGE))
      .force('center', forceCenter(size.width / 2, size.height / 2))
      .force('collide', forceCollide<SimNode>().radius((d) => radiusOf(d) + COLLIDE_LABEL_PAD));

    // 边 → line（初始 opacity 0，仿真收敛期 tick 渐显）
    const link = graph
      .append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, SimEdge>('line')
      .data(links)
      .join('line')
      .attr('class', 'edge')
      .attr('stroke', 'var(--color-border-secondary)')
      .attr('stroke-width', 1.5)
      .attr('opacity', 0)
      .on('click', (event) => event.stopPropagation()); // 点边不清除高亮

    // 节点 → g > (circle + text)
    const node = graph
      .append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, SimNode>('g')
      .data(simNodes)
      .join('g')
      .attr('class', 'node')
      .attr('cursor', 'grab')
      .attr('opacity', 0) // 初始不可见，仿真收敛期 tick 渐显
      .on('click', (event, d) => {
        // 拖拽结束后浏览器会补发一次 click → 视为拖拽而非点击，跳过高亮/浮窗切换
        if (draggedRef.current) {
          draggedRef.current = false;
          event.stopPropagation();
          return;
        }
        event.stopPropagation();
        setActiveId((prev) => (prev === d.id ? null : d.id));
        setTooltip((prev) => (prev && prev.node.id === d.id ? null : { node: d, x: event.pageX, y: event.pageY }));
      })

    node
      .append('circle')
      .attr('r', (d) => radiusOf(d))
      .attr('fill', (d) => TYPE_COLOR[d.type] ?? TYPE_COLOR['其他'])
      .attr('stroke', 'var(--color-bg)')
      .attr('stroke-width', 2);

    node
      .append('text')
      .attr('dx', (d) => radiusOf(d) + 8)
      .attr('dy', '0.35em')
      .attr('fill', 'var(--color-text)')
      .attr('font-size', 13)
      .text((d) => d.name);

    // 点击空白 → 清除高亮 + 浮窗
    svg.on('click', () => {
      setActiveId(null);
      setTooltip(null);
    });

    // 缩放 + 画布平移（d3-zoom）：滚轮缩放，空白处拖拽平移；作用于 graph 分组
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .on('zoom', (event) => {
        zoomTransformRef.current = event.transform; // 记住视口，resize 重建后恢复
        graph.attr('transform', event.transform);
      });
    svg.call(zoomBehavior).on('dblclick.zoom', null); // 禁用双击缩放，避免误触

    // 节点拖拽（d3-drag）：拖拽时写死 fx/fy 让仿真跟随，松开后释放回力导向
    const dragBehavior = drag<SVGGElement, SimNode>()
      .on('start', (event, d) => {
        draggedRef.current = false;
        event.sourceEvent.stopPropagation(); // 阻止冒泡到 svg，避免同时触发缩放平移
        simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        draggedRef.current = true;
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', () => {
        simulation.alphaTarget(0);
      });
    node.call(dragBehavior);

    // 重建后（如 resize）恢复上次缩放/平移视口
    if (zoomTransformRef.current) {
      svg.call(zoomBehavior.transform, zoomTransformRef.current);
    }

    // tick：每帧更新几何 + 收敛期渐显（opacity 随 alpha 衰减从 0→1）
    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as SimNode).x ?? 0)
        .attr('y1', (d) => (d.source as SimNode).y ?? 0)
        .attr('x2', (d) => (d.target as SimNode).x ?? 0)
        .attr('y2', (d) => (d.target as SimNode).y ?? 0);

      node.select('circle').attr('cx', (d) => d.x ?? 0).attr('cy', (d) => d.y ?? 0);
      node.select('text').attr('x', (d) => d.x ?? 0).attr('y', (d) => d.y ?? 0);

      // 方案 1（渐显）：alpha 从 1→SIM_READY_ALPHA 期间 opacity 0→1 平滑过渡
      if (!simReadyFlag) {
        const alpha = simulation.alpha();
        const fadeIn = alpha < SIM_READY_ALPHA ? 1 : Math.max(0, 1 - (alpha - SIM_READY_ALPHA) / (1 - SIM_READY_ALPHA));
        link.attr('opacity', fadeIn);
        node.attr('opacity', fadeIn);

        // 方案 3（overlay）：仿真收敛后通知 overlay 淡出
        if (alpha < SIM_READY_ALPHA) {
          simReadyFlag = true;
          setSimReady(true);
        }
      }
    });

    // 存入 ref，供 applyHighlight 在不重建仿真的前提下改样式
    nodeSelRef.current = node;
    linkSelRef.current = link;
    applyHighlight(); // 重建后（如 resize）保证高亮状态仍生效

    return () => {
      simulation.stop(); // 关键：停止 rAF 计时器，防 StrictMode 双挂载泄漏
      svg.selectAll('*').remove();
      nodeSelRef.current = null;
      linkSelRef.current = null;
    };
  }, [simNodes, simEdges, size, applyHighlight]);

  // 5) activeId 同步到 ref（供 d3 事件回调读取最新值）
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  // 6) 高亮重绘：activeId 或 simReady 变化时重算透明度（收敛完成后覆盖 tick 渐显值）
  useEffect(() => {
    applyHighlight();
  }, [applyHighlight, activeId, simReady]);

  // 7) overlay CSS transition 完毕后移除 DOM（避免 pointer-events 阻挡交互）
  useEffect(() => {
    if (!simReady) return;
    const t = setTimeout(() => setOverlayGone(true), 500); // 与 opacity transition 时长一致
    return () => clearTimeout(t);
  }, [simReady]);

  // 8) 组件卸载时清理 overlay 计时器
  useEffect(() => {
    return () => setOverlayGone(true); // 卸载时不需要 overlay
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', minHeight: MIN_SIZE }}
    >
      {/* 图例：横排在顶部独立行，不遮挡图谱 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
          flexShrink: 0,
          padding: '2px 4px 10px',
          fontSize: 12,
          color: 'var(--color-text-secondary)',
        }}
      >
        {(Object.keys(TYPE_COLOR) as GraphNode['type'][]).map((t) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: TYPE_COLOR[t],
                display: 'inline-block',
              }}
            />
            {t}
          </span>
        ))}
        <span style={{ marginLeft: 'auto' }}>点击看详情 · 再点关闭 · 滚轮缩放 · 拖拽节点</span>
      </div>

      {/* 图谱画布 */}
      <div ref={svgAreaRef} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <style>{`
          @keyframes kp-pulse {
            0%, 100% { opacity: 0.25; transform: scale(0.75); }
            50%      { opacity: 1;    transform: scale(1.1);  }
          }
        `}</style>

        <svg ref={svgRef} width={size.width} height={size.height} />

        {/* 加载遮罩 — 仿真收敛期覆盖画布；收敛后 opacity→0 淡出，transition 完成后移除 DOM */}
        {!overlayGone && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              background: 'var(--color-bg)',
              borderRadius: 8,
              zIndex: 10,
              opacity: simReady ? 0 : 1,
              transition: 'opacity 480ms ease',
              pointerEvents: simReady ? 'none' : 'auto',
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: 'var(--color-primary)',
                    animation: 'kp-pulse 1.2s ease-in-out infinite',
                    animationDelay: `${i * 0.2}s`,
                  }}
                />
              ))}
            </div>
            <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', letterSpacing: 1 }}>
              计算布局中…
            </span>
          </div>
        )}

        {/* 节点详情浮窗：点击节点弹出（fixed 定位，不跟随鼠标），再点同节点/空白关闭 */}
        {tooltip && (
          <div
            style={{
              position: 'fixed',
              left: tooltip.x + 14,
              top: tooltip.y + 14,
              zIndex: 1000,
              pointerEvents: 'auto',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 12,
              lineHeight: 1.6,
              maxWidth: 280,
              boxShadow: '0 4px 12px var(--color-shadow)',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{tooltip.node.name}</div>
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: TYPE_COLOR[tooltip.node.type] }}>●</span>{' '}
              <span style={{ color: 'var(--color-text-secondary)' }}>{tooltip.node.type}</span>
            </div>
            <div style={{ color: 'var(--color-text-secondary)' }}>{tooltip.node.definition}</div>
            {tooltip.node.doc_refs.length > 0 && (
              <div
                style={{
                  marginTop: 6,
                  borderTop: '1px solid var(--color-border)',
                  paddingTop: 6,
                }}
              >
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>
                  来源文档：
                </div>
                {tooltip.node.doc_refs.map((docId, i) => {
                  const filename = docNames[docId] || docId;
                  return (
                  <div
                    key={i}
                    onClick={() => currentKbId && navigate(`/wendang/${currentKbId}/${docId}`)}
                    style={{
                      display: 'flex',
                      gap: 4,
                      alignItems: 'center',
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                      borderRadius: 4,
                      padding: '2px 4px',
                      margin: '0 -4px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--color-primary-bg)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <FileTextOutlined style={{ fontSize: 10 }} /> {filename}
                  </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default KnowledgeGraph;
