import type { Act, Peak } from '../../types';

export function TensionCurve({
  data,
  acts,
  peaks,
  fill = 'none',
  stroke = 'var(--ink)',
  label,
  width: w = 800,
  height: h = 200,
}: {
  data: number[];
  acts?: Act[];
  peaks?: Peak[];
  fill?: string;
  stroke?: string;
  label?: string;
  width?: number;
  height?: number;
}) {
  const n = data.length;
  const xAt = (i: number) => (i / (n - 1)) * (w - 40) + 30;
  const yAt = (v: number) => h - 20 - (v / 10) * (h - 40);

  // Build line path
  const linePath = data
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`)
    .join(' ');

  // Build area path (closed)
  const areaPath = `${linePath} L${xAt(n - 1).toFixed(1)},${yAt(0).toFixed(1)} L${xAt(0).toFixed(1)},${yAt(0).toFixed(1)} Z`;

  // Gridlines at 0,2,4,6,8,10
  const gridLevels = [0, 2, 4, 6, 8, 10];

  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {/* Horizontal gridlines */}
      {gridLevels.map((v) => (
        <g key={v}>
          <line
            x1={30}
            y1={yAt(v)}
            x2={w - 10}
            y2={yAt(v)}
            stroke="var(--line-2)"
            strokeWidth={1}
          />
          <text
            x={4}
            y={yAt(v) + 3}
            fill="var(--ink-3)"
            fontSize={9}
            fontFamily="var(--font-mono)"
          >
            {v}
          </text>
        </g>
      ))}

      {/* Act dividers */}
      {acts?.map((act) => (
        <g key={act.label}>
          <line
            x1={xAt(act.at)}
            y1={yAt(10)}
            x2={xAt(act.at)}
            y2={yAt(0)}
            stroke="var(--ink-3)"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <text
            x={xAt(act.at) + 4}
            y={yAt(10) - 4}
            fill="var(--ink-3)"
            fontSize={9}
            fontFamily="var(--font-mono)"
            letterSpacing="0.06em"
          >
            {act.label}
          </text>
        </g>
      ))}

      {/* Area fill */}
      {fill !== 'none' && (
        <path d={areaPath} fill={fill} opacity={0.12} />
      )}

      {/* Line */}
      <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.5} />

      {/* Peaks */}
      {peaks?.map((peak) => (
        <g key={peak.label}>
          <circle
            cx={xAt(peak.at)}
            cy={yAt(peak.v)}
            r={4}
            fill={stroke}
          />
          <text
            x={xAt(peak.at)}
            y={yAt(peak.v) - 10}
            fill="var(--ink)"
            fontSize={9}
            fontFamily="var(--font-mono)"
            textAnchor="middle"
            letterSpacing="0.04em"
          >
            {peak.label}
          </text>
        </g>
      ))}

      {/* Label */}
      {label && (
        <text
          x={30}
          y={14}
          fill="var(--ink-3)"
          fontSize={9}
          fontFamily="var(--font-mono)"
          letterSpacing="0.08em"
          textTransform="uppercase"
        >
          {label}
        </text>
      )}
    </svg>
  );
}
