import { useCallback, useMemo } from 'react';
import { scaleLinear } from '@visx/scale';
import { LinePath, AreaClosed } from '@visx/shape';
import { useTooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import type { Act, Peak } from '../../types';

export interface TensionTooltipDatum {
  index: number;
  value: number;
}

export interface FacetLayer {
  name: string;
  data: number[];
  stroke: string;
}

interface TensionCurveProps {
  data: number[];
  acts?: Act[];
  peaks?: Peak[];
  fill?: string;
  stroke?: string;
  label?: string;
  width?: number;
  height?: number;
  onPointClick?: (index: number) => void;
  renderTooltip?: (datum: TensionTooltipDatum) => React.ReactNode;
  facets?: FacetLayer[];
}

const PAD_LEFT = 30;
const PAD_RIGHT = 10;
const PAD_TOP = 20;
const PAD_BOTTOM = 20;
const GRID_LEVELS = [0, 2, 4, 6, 8, 10];

export function TensionCurve({
  data,
  acts,
  peaks,
  fill = 'none',
  stroke = 'var(--ink)',
  label,
  width: w = 800,
  height: h = 200,
  onPointClick,
  renderTooltip,
  facets,
}: TensionCurveProps) {
  const n = data.length;

  const xScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [0, Math.max(1, n - 1)],
        range: [PAD_LEFT, w - PAD_RIGHT],
      }),
    [n, w],
  );

  const yScale = useMemo(
    () =>
      scaleLinear<number>({
        domain: [0, 10],
        range: [h - PAD_BOTTOM, PAD_TOP],
      }),
    [h],
  );

  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    showTooltip,
    hideTooltip,
  } = useTooltip<TensionTooltipDatum>();

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<SVGRectElement>) => {
      if (n === 0) return;
      const point = localPoint(event);
      if (!point) return;
      const i = Math.max(0, Math.min(n - 1, Math.round(xScale.invert(point.x))));
      showTooltip({
        tooltipData: { index: i, value: data[i] },
        tooltipLeft: xScale(i),
        tooltipTop: yScale(data[i]),
      });
    },
    [data, n, xScale, yScale, showTooltip],
  );

  const handleClick = useCallback(() => {
    if (tooltipData && onPointClick) onPointClick(tooltipData.index);
  }, [tooltipData, onPointClick]);

  if (n === 0) {
    return <svg width={w} height={h} style={{ display: 'block' }} />;
  }

  return (
    <div style={{ position: 'relative', width: w, height: h }}>
      <svg width={w} height={h} style={{ display: 'block' }}>
        {GRID_LEVELS.map((v) => (
          <g key={v}>
            <line
              x1={PAD_LEFT}
              y1={yScale(v)}
              x2={w - PAD_RIGHT}
              y2={yScale(v)}
              stroke="var(--line-2)"
              strokeWidth={1}
            />
            <text
              x={4}
              y={yScale(v) + 3}
              fill="var(--ink-3)"
              fontSize={9}
              fontFamily="var(--font-mono)"
            >
              {v}
            </text>
          </g>
        ))}

        {acts?.map((act) => (
          <g key={act.label}>
            <line
              x1={xScale(act.at)}
              y1={yScale(10)}
              x2={xScale(act.at)}
              y2={yScale(0)}
              stroke="var(--ink-3)"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text
              x={xScale(act.at) + 4}
              y={yScale(10) - 4}
              fill="var(--ink-3)"
              fontSize={9}
              fontFamily="var(--font-mono)"
              letterSpacing="0.06em"
            >
              {act.label}
            </text>
          </g>
        ))}

        {fill !== 'none' && (
          <AreaClosed<number>
            data={data}
            x={(_d, i) => xScale(i) ?? 0}
            y={(d) => yScale(d) ?? 0}
            yScale={yScale}
            fill={fill}
            opacity={0.12}
          />
        )}

        {facets?.map((facet) => (
          <LinePath<number>
            key={facet.name}
            data={facet.data}
            x={(_d, i) => xScale(i) ?? 0}
            y={(d) => yScale(d) ?? 0}
            stroke={facet.stroke}
            strokeWidth={1}
            strokeOpacity={0.55}
            strokeDasharray="3 3"
            fill="none"
          />
        ))}

        <LinePath<number>
          data={data}
          x={(_d, i) => xScale(i) ?? 0}
          y={(d) => yScale(d) ?? 0}
          stroke={stroke}
          strokeWidth={1.5}
          fill="none"
        />

        {peaks?.map((peak) => (
          <g key={peak.label}>
            <circle cx={xScale(peak.at)} cy={yScale(peak.v)} r={4} fill={stroke} />
            <text
              x={xScale(peak.at)}
              y={yScale(peak.v) - 10}
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

        {label && (
          <text
            x={PAD_LEFT}
            y={14}
            fill="var(--ink-3)"
            fontSize={9}
            fontFamily="var(--font-mono)"
            letterSpacing="0.08em"
          >
            {label}
          </text>
        )}

        {tooltipData && tooltipLeft != null && tooltipTop != null && (
          <g pointerEvents="none">
            <line
              x1={tooltipLeft}
              x2={tooltipLeft}
              y1={yScale(10)}
              y2={yScale(0)}
              stroke="var(--ink)"
              strokeWidth={1}
              strokeDasharray="2 2"
            />
            <circle
              cx={tooltipLeft}
              cy={tooltipTop}
              r={3.5}
              fill="var(--paper)"
              stroke="var(--ink)"
              strokeWidth={1.5}
            />
          </g>
        )}

        <rect
          x={PAD_LEFT}
          y={PAD_TOP}
          width={w - PAD_LEFT - PAD_RIGHT}
          height={h - PAD_TOP - PAD_BOTTOM}
          fill="transparent"
          style={{ cursor: onPointClick ? 'pointer' : 'default' }}
          onPointerMove={handlePointerMove}
          onPointerLeave={hideTooltip}
          onClick={handleClick}
        />
      </svg>

      {tooltipData && tooltipLeft != null && tooltipTop != null && (
        <TooltipWithBounds
          top={tooltipTop - 8}
          left={tooltipLeft + 8}
          style={{
            ...defaultStyles,
            background: 'var(--paper)',
            border: '1px solid var(--ink)',
            color: 'var(--ink)',
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            padding: '6px 8px',
            borderRadius: 0,
            boxShadow: '2px 2px 0 var(--ink)',
          }}
        >
          {renderTooltip ? (
            renderTooltip(tooltipData)
          ) : (
            <div>
              <div
                style={{
                  letterSpacing: '0.08em',
                  color: 'var(--ink-3)',
                  textTransform: 'uppercase',
                }}
              >
                S{String(tooltipData.index + 1).padStart(2, '0')}
              </div>
              <div style={{ marginTop: 2 }}>tension {tooltipData.value}</div>
            </div>
          )}
        </TooltipWithBounds>
      )}
    </div>
  );
}
