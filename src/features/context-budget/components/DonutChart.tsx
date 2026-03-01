"use client";

import { memo } from "react";

export type DonutSegment = {
  value: number;
  color: string;
  label: string;
};

interface DonutChartProps {
  segments: DonutSegment[];
  /** Outer radius in SVG units */
  radius?: number;
  /** Thickness of the donut ring */
  thickness?: number;
  /** Center label (main number) */
  centerLabel?: string;
  /** Center sublabel */
  centerSublabel?: string;
  /** SVG viewBox size (square) */
  size?: number;
  /** Gap angle between segments in radians */
  gapAngle?: number;
}

/** Convert polar to cartesian coordinates */
function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  return {
    x: cx + r * Math.cos(angle),
    y: cy + r * Math.sin(angle),
  };
}

/** Build SVG arc path for a donut segment */
function buildArcPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
): string {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const o1 = polarToCartesian(cx, cy, outerR, startAngle);
  const o2 = polarToCartesian(cx, cy, outerR, endAngle);
  const i1 = polarToCartesian(cx, cy, innerR, endAngle);
  const i2 = polarToCartesian(cx, cy, innerR, startAngle);

  return [
    `M ${o1.x.toFixed(3)} ${o1.y.toFixed(3)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${o2.x.toFixed(3)} ${o2.y.toFixed(3)}`,
    `L ${i1.x.toFixed(3)} ${i1.y.toFixed(3)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${i2.x.toFixed(3)} ${i2.y.toFixed(3)}`,
    "Z",
  ].join(" ");
}

/**
 * Pure SVG donut chart — no external dependencies.
 * Renders proportional arc segments with an optional center label.
 */
export const DonutChart = memo(function DonutChart({
  segments,
  radius = 45,
  thickness = 16,
  centerLabel,
  centerSublabel,
  size = 120,
  gapAngle = 0.04,
}: DonutChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const innerR = radius - thickness;

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  // Render empty circle if total is 0
  if (total === 0) {
    return (
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        aria-hidden="true"
        role="img"
        aria-label="Context budget donut chart — no data"
      >
        <circle
          cx={cx}
          cy={cy}
          r={radius - thickness / 2}
          fill="none"
          stroke="currentColor"
          strokeWidth={thickness}
          className="text-muted/40"
        />
        {centerLabel && (
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="12"
            fontWeight="600"
            fill="currentColor"
            className="text-muted-foreground"
          >
            {centerLabel}
          </text>
        )}
      </svg>
    );
  }

  // Calculate arc angles, starting from top (−π/2)
  let currentAngle = -Math.PI / 2;
  const arcs: Array<{ path: string; color: string; label: string }> = [];

  for (const segment of segments) {
    if (segment.value <= 0) continue;
    const proportion = segment.value / total;
    const sweep = proportion * (2 * Math.PI) - gapAngle;
    if (sweep <= 0) continue;

    const startAngle = currentAngle + gapAngle / 2;
    const endAngle = startAngle + sweep;

    arcs.push({
      path: buildArcPath(cx, cy, radius, innerR, startAngle, endAngle),
      color: segment.color,
      label: segment.label,
    });

    currentAngle += proportion * (2 * Math.PI);
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label="Context budget donut chart"
    >
      {arcs.map((arc) => (
        <path
          key={arc.label}
          d={arc.path}
          fill={arc.color}
          aria-label={arc.label}
        />
      ))}
      {/* Center labels */}
      {centerLabel && (
        <>
          <text
            x={cx}
            y={centerSublabel ? cy - 7 : cy}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize="13"
            fontWeight="700"
            fill="currentColor"
          >
            {centerLabel}
          </text>
          {centerSublabel && (
            <text
              x={cx}
              y={cy + 10}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="8"
              fill="currentColor"
              opacity="0.6"
            >
              {centerSublabel}
            </text>
          )}
        </>
      )}
    </svg>
  );
});
