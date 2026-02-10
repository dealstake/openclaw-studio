"use client";

import { memo, useMemo } from "react";

type TokenProgressBarProps = {
  used: number;
  limit: number | undefined;
  className?: string;
};

export const TokenProgressBar = memo(function TokenProgressBar({
  used,
  limit,
  className = "",
}: TokenProgressBarProps) {
  const { pct, color, tooltip } = useMemo(() => {
    if (!limit || limit <= 0) return { pct: 0, color: "", tooltip: "" };
    const p = Math.min(100, Math.round((used / limit) * 100));
    const c =
      p >= 80
        ? "bg-destructive/80"
        : p >= 60
          ? "bg-yellow-500/70"
          : "bg-emerald-500/60";
    const t = `${p}% · ${used.toLocaleString()} / ${limit.toLocaleString()} tokens`;
    return { pct: p, color: c, tooltip: t };
  }, [used, limit]);

  if (!limit || limit <= 0) return null;

  return (
    <div
      className={`h-1 w-full overflow-hidden rounded-full bg-muted/50 ${className}`}
      title={tooltip}
    >
      <div
        className={`h-full rounded-full transition-all duration-300 ${color}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
});
