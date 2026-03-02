"use client";

import { memo, useMemo } from "react";

interface TrendSparklineProps {
  /** Data points (oldest → newest). Min 2. Alias: `values` */
  data?: number[];
  /** Alias for `data` */
  values?: number[];
  /** Width of the SVG (default: 60) */
  width?: number;
  /** Height of the SVG (default: 20) */
  height?: number;
  /** Stroke color (default: currentColor) */
  color?: string;
  /** Highlight the last point with a dot */
  highlightLast?: boolean;
  /** CSS class */
  className?: string;
}

/**
 * Tiny SVG sparkline for trend data.
 * Renders a polyline normalized to the container dimensions.
 */
export const TrendSparkline = memo(function TrendSparkline({
  data,
  values,
  width = 60,
  height = 20,
  color = "currentColor",
  highlightLast = false,
  className,
}: TrendSparklineProps) {
  const pts = data ?? values;

  const parsed = useMemo(() => {
    if (!pts || pts.length < 2) return null;

    const max = pts.reduce((a, b) => (b > a ? b : a), 1);
    const min = pts.reduce((a, b) => (b < a ? b : a), max);
    const range = max - min || 1;
    const padding = highlightLast ? 2 : 0;
    const w = width - padding * 2;
    const h = height - padding * 2;

    const coords = pts.map((v, i) => ({
      x: padding + (i / (pts.length - 1)) * w,
      y: padding + h - ((v - min) / range) * h,
    }));

    const points = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    const last = coords[coords.length - 1];
    return { points, last };
  }, [pts, width, height, highlightLast]);

  if (!parsed) return null;

  return (
    <svg
      width={width}
      height={height}
      className={className ?? "inline-block"}
      aria-label={`Trend: ${pts?.length ?? 0} points, latest ${pts?.[pts.length - 1] ?? 0}`}
      aria-hidden={!highlightLast ? "true" : undefined}
    >
      <polyline
        points={parsed.points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={highlightLast ? 0.6 : 1}
      />
      {highlightLast && parsed.last && (
        <circle
          cx={parsed.last.x}
          cy={parsed.last.y}
          r={2}
          fill={color}
          opacity={0.9}
        />
      )}
    </svg>
  );
});
