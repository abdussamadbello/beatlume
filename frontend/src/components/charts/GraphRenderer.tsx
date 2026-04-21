import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
} from 'd3-force';
import type {
  Simulation,
  SimulationLinkDatum,
  SimulationNodeDatum,
} from 'd3-force';
import { select } from 'd3-selection';
import { zoom as d3Zoom, zoomIdentity } from 'd3-zoom';
import type { D3ZoomEvent, ZoomBehavior } from 'd3-zoom';
import { drag as d3Drag } from 'd3-drag';
import type { D3DragEvent } from 'd3-drag';
import type { EdgeKind, GraphEdge, SceneNode } from '../../types';

const edgeStyles: Record<EdgeKind, { stroke: string; dasharray?: string }> = {
  conflict: { stroke: 'var(--red)', dasharray: '6 3' },
  alliance: { stroke: 'var(--blue)' },
  romance: { stroke: 'oklch(0.65 0.15 350)' },
  mentor: { stroke: 'var(--ink)' },
  secret: { stroke: 'var(--ink-3)', dasharray: '2 3' },
  family: { stroke: 'var(--green)' },
};

interface SimNode extends SimulationNodeDatum {
  id: string;
  label: string;
  initials: string;
  node_type?: 'hub' | 'minor';
  first_appearance_scene: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  id: string;
  kind: EdgeKind;
  weight: number;
}

interface NodeSnapshot {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphRendererProps {
  nodes: SceneNode[];
  edges: GraphEdge[];
  width?: number;
  height?: number;
  onNodeClick?: (id: string) => void;
  selectedId?: string;
  /**
   * If set, nodes/edges that haven't been "introduced" by `timeSlice` fade
   * out (opacity 0) but remain in the simulation, so the layout stays
   * stable as the user scrubs the timeline.
   */
  timeSlice?: number;
  /**
   * When false, disables zoom/pan/drag/click. The simulation still runs
   * but with faster decay so the embed settles quickly. Defaults to true.
   */
  interactive?: boolean;
}

const radiusFor = (n: { node_type?: 'hub' | 'minor' }) =>
  n.node_type === 'hub' ? 22 : n.node_type === 'minor' ? 12 : 17;

const FADE_MS = 280;

export function GraphRenderer({
  nodes,
  edges,
  width: w = 640,
  height: h = 460,
  onNodeClick,
  selectedId,
  timeSlice,
  interactive = true,
}: GraphRendererProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewportRef = useRef<SVGGElement | null>(null);
  const simRef = useRef<Simulation<SimNode, SimLink> | null>(null);
  const zoomBehaviorRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const dragMovedRef = useRef(false);
  // Carries x/y/vx/vy across simulation rebuilds so layout stays stable
  // when the node set changes (filters, time-scrubbing, etc.).
  const lastPositionsRef = useRef<Map<string, NodeSnapshot>>(new Map());

  // Pure derivation from props.
  const simNodes = useMemo<SimNode[]>(
    () =>
      nodes.map((n) => ({
        id: n.id,
        label: n.label,
        initials: n.initials,
        node_type: n.node_type,
        first_appearance_scene: n.first_appearance_scene,
        x: n.x,
        y: n.y,
      })),
    [nodes],
  );

  const nodeIdSet = useMemo(() => new Set(simNodes.map((n) => n.id)), [simNodes]);

  const simLinks = useMemo<SimLink[]>(
    () =>
      edges
        .filter((e) => nodeIdSet.has(e.source_node_id) && nodeIdSet.has(e.target_node_id))
        .map((e) => ({
          id: e.id,
          kind: e.kind,
          weight: e.weight,
          source: e.source_node_id,
          target: e.target_node_id,
        })),
    [edges, nodeIdSet],
  );

  // Visibility sets driven by the time scrubber. `null` means "no filter".
  const visibleNodeIds = useMemo<Set<string> | null>(() => {
    if (timeSlice == null) return null;
    return new Set(
      nodes.filter((n) => n.first_appearance_scene <= timeSlice).map((n) => n.id),
    );
  }, [nodes, timeSlice]);

  const visibleEdgeIds = useMemo<Set<string> | null>(() => {
    if (timeSlice == null) return null;
    return new Set(
      edges
        .filter(
          (e) =>
            e.first_evidenced_scene <= timeSlice &&
            (visibleNodeIds == null ||
              (visibleNodeIds.has(e.source_node_id) &&
                visibleNodeIds.has(e.target_node_id))),
        )
        .map((e) => e.id),
    );
  }, [edges, timeSlice, visibleNodeIds]);

  // Per-edge curvature metadata: index within its undirected pair group + total count.
  const curvatureByEdge = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const e of simLinks) {
      const sId =
        typeof e.source === 'object' ? (e.source as SimNode).id : (e.source as string);
      const tId =
        typeof e.target === 'object' ? (e.target as SimNode).id : (e.target as string);
      const key = sId < tId ? `${sId}|${tId}` : `${tId}|${sId}`;
      const arr = groups.get(key) ?? [];
      arr.push(e.id);
      groups.set(key, arr);
    }
    const meta = new Map<string, { index: number; count: number }>();
    for (const arr of groups.values()) {
      arr.forEach((id, i) => meta.set(id, { index: i, count: arr.length }));
    }
    return meta;
  }, [simLinks]);

  // Simulation positions, populated by the d3 `tick` callback (outside
  // render and outside the effect body, so the new react-hooks/refs and
  // react-hooks/set-state-in-effect rules don't apply).
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(
    () => new Map(),
  );

  useEffect(() => {
    // Clone simNodes so the simulation can mutate its own copies (the
    // useMemo'd `simNodes` array is owned by render and must not be mutated).
    // Seed clones with positions from the previous simulation to keep the
    // layout stable across rebuilds.
    const localNodes: SimNode[] = simNodes.map((n) => {
      const prev = lastPositionsRef.current.get(n.id);
      return prev
        ? {
            ...n,
            x: prev.x,
            y: prev.y,
            vx: prev.vx,
            vy: prev.vy,
            fx: prev.fx,
            fy: prev.fy,
          }
        : { ...n };
    });
    // Same for links — d3-force resolves source/target string ids against
    // the local node array.
    const localLinks: SimLink[] = simLinks.map((l) => ({
      id: l.id,
      kind: l.kind,
      weight: l.weight,
      source:
        typeof l.source === 'object' ? (l.source as SimNode).id : (l.source as string),
      target:
        typeof l.target === 'object' ? (l.target as SimNode).id : (l.target as string),
    }));

    // With no edges, repulsion alone pushes nodes to the viewport corners; ease charge
    // so the graph stays more compact when the story truly has no links yet.
    const charge =
      localLinks.length === 0 ? -95 : localLinks.length < 4 ? -160 : -220;

    const sim = forceSimulation<SimNode, SimLink>(localNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(localLinks)
          .id((d) => d.id)
          .distance(80)
          .strength(0.55),
      )
      .force('charge', forceManyBody<SimNode>().strength(charge))
      .force('center', forceCenter(w / 2, h / 2))
      .force(
        'collide',
        forceCollide<SimNode>().radius((d) => radiusFor(d) + 6),
      )
      .alpha(0.9)
      // Static previews settle ~3x faster than the interactive view.
      .alphaDecay(interactive ? 0.04 : 0.12);

    simRef.current = sim;

    sim.on('tick', () => {
      const next = new Map<string, { x: number; y: number }>();
      const snap = new Map<string, NodeSnapshot>();
      for (const n of localNodes) {
        const x = n.x ?? 0;
        const y = n.y ?? 0;
        next.set(n.id, { x, y });
        snap.set(n.id, { x, y, vx: n.vx, vy: n.vy, fx: n.fx, fy: n.fy });
      }
      lastPositionsRef.current = snap;
      setPositions(next);
    });

    return () => {
      sim.on('tick', null);
      sim.stop();
      if (simRef.current === sim) simRef.current = null;
    };
  }, [simNodes, simLinks, interactive, w, h]);

  // Pan + zoom on the SVG, applied to the viewport <g>.
  const [zoomTransform, setZoomTransform] = useState({ k: 1, x: 0, y: 0 });

  useEffect(() => {
    if (!interactive || !svgRef.current) return;
    const svg = select(svgRef.current);

    const behavior = d3Zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 4])
      .filter((event: Event) => {
        const target = event.target as Element | null;
        if (target?.closest('[data-node]')) return false;
        if (event.type !== 'mousedown') return true;
        const me = event as MouseEvent;
        return !me.ctrlKey && me.button === 0;
      })
      .on('zoom', (event: D3ZoomEvent<SVGSVGElement, unknown>) => {
        const { k, x, y } = event.transform;
        setZoomTransform({ k, x, y });
      });

    zoomBehaviorRef.current = behavior;
    svg.call(behavior);

    return () => {
      svg.on('.zoom', null);
      if (zoomBehaviorRef.current === behavior) zoomBehaviorRef.current = null;
    };
  }, [interactive]);

  // Per-node drag.
  useEffect(() => {
    if (!interactive || !viewportRef.current) return;
    const sim = simRef.current;
    if (!sim) return;

    const groups = select(viewportRef.current).selectAll<SVGGElement, unknown>(
      'g[data-node]',
    );

    const findNode = (id: string | null): SimNode | undefined =>
      id ? sim.nodes().find((n) => n.id === id) : undefined;

    const behavior = d3Drag<SVGGElement, unknown>()
      .on('start', function (event: D3DragEvent<SVGGElement, unknown, SimNode>) {
        const d = findNode(this.getAttribute('data-id'));
        if (!d) return;
        dragMovedRef.current = false;
        if (!event.active) sim.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', function (event: D3DragEvent<SVGGElement, unknown, SimNode>) {
        const d = findNode(this.getAttribute('data-id'));
        if (!d) return;
        dragMovedRef.current = true;
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', function (event: D3DragEvent<SVGGElement, unknown, SimNode>) {
        const d = findNode(this.getAttribute('data-id'));
        if (!d) return;
        if (!event.active) sim.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    groups.call(behavior);

    return () => {
      groups.on('.drag', null);
    };
  }, [interactive, simNodes]);

  const handleReset = useCallback(() => {
    const sim = simRef.current;
    if (sim) {
      for (const n of sim.nodes()) {
        n.fx = null;
        n.fy = null;
      }
      sim.alpha(0.9).restart();
    }
    if (svgRef.current && zoomBehaviorRef.current) {
      select(svgRef.current).call(zoomBehaviorRef.current.transform, zoomIdentity);
    } else {
      setZoomTransform({ k: 1, x: 0, y: 0 });
    }
  }, []);

  const positionFor = (n: SimNode) =>
    positions.get(n.id) ?? { x: n.x ?? w / 2, y: n.y ?? h / 2 };

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: w,
        aspectRatio: `${w} / ${h}`,
      }}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid meet"
        style={{ display: 'block', cursor: interactive ? 'grab' : 'default' }}
      >
        <defs>
          <pattern id="dot-grid" width={24} height={24} patternUnits="userSpaceOnUse">
            <circle cx={12} cy={12} r={0.8} fill="var(--line-2)" />
          </pattern>
        </defs>
        <rect width={w} height={h} fill="url(#dot-grid)" />

        <g
          ref={viewportRef}
          transform={`translate(${zoomTransform.x},${zoomTransform.y}) scale(${zoomTransform.k})`}
        >
          {/* Edges */}
          {simLinks.map((edge) => {
            const fromId =
              typeof edge.source === 'object'
                ? (edge.source as SimNode).id
                : (edge.source as string);
            const toId =
              typeof edge.target === 'object'
                ? (edge.target as SimNode).id
                : (edge.target as string);
            const from = positions.get(fromId);
            const to = positions.get(toId);
            if (!from || !to) return null;

            const style = edgeStyles[edge.kind];
            const meta = curvatureByEdge.get(edge.id);
            const visible = visibleEdgeIds == null || visibleEdgeIds.has(edge.id);

            let d: string;
            if (!meta || meta.count <= 1) {
              d = `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
            } else {
              const dx = to.x - from.x;
              const dy = to.y - from.y;
              const len = Math.hypot(dx, dy) || 1;
              const nx = -dy / len;
              const ny = dx / len;
              const spread = Math.min(28, 14 + meta.count * 4);
              const offset = (meta.index - (meta.count - 1) / 2) * spread;
              const mx = (from.x + to.x) / 2 + nx * offset;
              const my = (from.y + to.y) / 2 + ny * offset;
              d = `M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`;
            }

            return (
              <path
                key={edge.id}
                d={d}
                fill="none"
                stroke={style.stroke}
                strokeWidth={Math.max(1, edge.weight)}
                strokeDasharray={style.dasharray}
                style={{
                  opacity: visible ? 1 : 0,
                  pointerEvents: visible ? 'auto' : 'none',
                  transition: `opacity ${FADE_MS}ms ease`,
                }}
              />
            );
          })}

          {/* Nodes */}
          {simNodes.map((node) => {
            const r = radiusFor(node);
            const filled = node.node_type === 'hub';
            const isSelected = node.id === selectedId;
            const strokeColor = isSelected
              ? 'var(--blue)'
              : node.node_type === 'minor'
                ? 'var(--ink-3)'
                : 'var(--ink)';
            const strokeW = isSelected ? 2.5 : filled ? 0 : 1.5;
            const { x, y } = positionFor(node);
            const visible = visibleNodeIds == null || visibleNodeIds.has(node.id);
            const clickable = interactive && !!onNodeClick && visible;
            return (
              <g
                key={node.id}
                data-node=""
                data-id={node.id}
                style={{
                  cursor: clickable ? 'pointer' : interactive ? 'grab' : 'default',
                  opacity: visible ? 1 : 0,
                  pointerEvents: visible ? 'auto' : 'none',
                  transition: `opacity ${FADE_MS}ms ease`,
                }}
                onClick={(e) => {
                  if (!clickable) return;
                  if (dragMovedRef.current) return;
                  e.stopPropagation();
                  onNodeClick?.(node.id);
                }}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={r}
                  fill={filled ? 'var(--ink)' : 'var(--paper)'}
                  stroke={strokeColor}
                  strokeWidth={strokeW}
                />
                <text
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  fill={filled ? 'var(--paper)' : 'var(--ink)'}
                  fontSize={r > 15 ? 11 : 9}
                  fontFamily="var(--font-mono)"
                  fontWeight={500}
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {node.initials}
                </text>
                <text
                  x={x}
                  y={y + r + 14}
                  textAnchor="middle"
                  fill="var(--ink-3)"
                  fontSize={9}
                  fontFamily="var(--font-mono)"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {interactive && (
        <button
          type="button"
          onClick={handleReset}
          aria-label="Reset graph layout and zoom"
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            padding: '4px 8px',
            background: 'var(--paper)',
            border: '1px solid var(--ink)',
            color: 'var(--ink)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            boxShadow: '2px 2px 0 var(--ink)',
            lineHeight: 1.2,
          }}
        >
          {'\u21BB'} Reset
        </button>
      )}
    </div>
  );
}
