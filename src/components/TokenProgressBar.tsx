"use client";

import { memo, useMemo } from "react";

type TokenProgressBarProps = {
  used: number;
  limit: number | undefined;
  className?: string;
  compact?: boolean;
};

export const TokenProgressBar = memo(function TokenProgressBar({
  used,
  limit,
  className = "",
  compact = false,
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

  if (compact) {
    return (
      <div className={`h-1.5 w-full overflow-hidden rounded-full bg-muted/50 ${className}`} title={tooltip}>
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`} title={tooltip}>
      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted/50">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{pct}%</span>
    </div>
  );
});
