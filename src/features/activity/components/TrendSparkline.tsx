"use client";

import { memo } from "react";

/**
 * Tiny SVG sparkline for trend data.
 * Renders a polyline normalized to the container dimensions.
 */
export const TrendSparkline = memo(function TrendSparkline({
  data,
  width = 60,
  height = 20,
  color = "currentColor",
}: {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (data.length < 2) return null;

  const max = Math.max(...data, 1);
  const points = data
    .map(
      (v, i) =>
        `${(i / (data.length - 1)) * width},${height - (v / max) * height}`
    )
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className="inline-block"
      aria-label={`Trend: ${data.length} points, latest ${data[data.length - 1]}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
});
