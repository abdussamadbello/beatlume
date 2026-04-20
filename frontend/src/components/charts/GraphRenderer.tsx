import type { SceneNode, GraphEdge, EdgeKind } from '../../types';

const edgeStyles: Record<EdgeKind, { stroke: string; dasharray?: string }> = {
  conflict: { stroke: 'var(--red)', dasharray: '6 3' },
  alliance: { stroke: 'var(--blue)' },
  romance: { stroke: 'oklch(0.65 0.15 350)' },
  mentor: { stroke: 'var(--ink)' },
  secret: { stroke: 'var(--ink-3)', dasharray: '2 3' },
  family: { stroke: 'var(--green)' },
};

export function GraphRenderer({
  nodes,
  edges,
  width: w = 640,
  height: h = 460,
  onNodeClick,
  selectedId,
}: {
  nodes: SceneNode[];
  edges: GraphEdge[];
  width?: number;
  height?: number;
  onNodeClick?: (id: string) => void;
  selectedId?: string;
}) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {/* Dot-grid background */}
      <defs>
        <pattern id="dot-grid" width={24} height={24} patternUnits="userSpaceOnUse">
          <circle cx={12} cy={12} r={0.8} fill="var(--line-2)" />
        </pattern>
      </defs>
      <rect width={w} height={h} fill="url(#dot-grid)" />

      {/* Edges */}
      {edges.map((edge, i) => {
        const from = nodeMap.get(edge.source_node_id);
        const to = nodeMap.get(edge.target_node_id);
        if (!from || !to) return null;
        const style = edgeStyles[edge.kind];
        return (
          <line
            key={i}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={style.stroke}
            strokeWidth={Math.max(1, edge.weight)}
            strokeDasharray={style.dasharray}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map((node) => {
        const r = node.node_type === 'hub' ? 22 : node.node_type === 'minor' ? 12 : 17;
        const filled = node.node_type === 'hub';
        const isSelected = node.id === selectedId;
        const strokeColor = isSelected ? 'var(--blue)' : node.node_type === 'minor' ? 'var(--ink-3)' : 'var(--ink)';
        const strokeW = isSelected ? 2.5 : filled ? 0 : 1.5;
        return (
          <g key={node.id} style={{ cursor: onNodeClick ? 'pointer' : 'default' }} onClick={() => onNodeClick?.(node.id)}>
            <circle
              cx={node.x}
              cy={node.y}
              r={r}
              fill={filled ? 'var(--ink)' : 'var(--paper)'}
              stroke={strokeColor}
              strokeWidth={strokeW}
            />
            <text
              x={node.x}
              y={node.y + 4}
              textAnchor="middle"
              fill={filled ? 'var(--paper)' : 'var(--ink)'}
              fontSize={r > 15 ? 11 : 9}
              fontFamily="var(--font-mono)"
              fontWeight={500}
            >
              {node.initials}
            </text>
            <text
              x={node.x}
              y={node.y + r + 14}
              textAnchor="middle"
              fill="var(--ink-3)"
              fontSize={9}
              fontFamily="var(--font-mono)"
            >
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
