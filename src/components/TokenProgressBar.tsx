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
  const { pct, fillGreen, fillYellow, fillRed, tooltip } = useMemo(() => {
    if (!limit || limit <= 0)
      return { pct: 0, fillGreen: "0%", fillYellow: "0%", fillRed: "0%", tooltip: "" };
    const p = Math.min(100, Math.round((used / limit) * 100));
    const t = `${p}% · ${used.toLocaleString()} / ${limit.toLocaleString()} tokens`;

    let fG: string;
    let fY: string;
    let fR: string;
    if (p <= 60) {
      fG = `${(p / 60) * 100}%`;
      fY = "0%";
      fR = "0%";
    } else if (p <= 80) {
      fG = "100%";
      fY = `${((p - 60) / 20) * 100}%`;
      fR = "0%";
    } else {
      fG = "100%";
      fY = "100%";
      fR = `${((p - 80) / 20) * 100}%`;
    }
    return { pct: p, fillGreen: fG, fillYellow: fY, fillRed: fR, tooltip: t };
  }, [used, limit]);

  if (!limit || limit <= 0) return null;

  const barHeight = compact ? "h-1.5" : "h-2";

  const bar = (
    <div className={`flex ${barHeight} w-full overflow-hidden rounded-full`} title={tooltip}>
      <div className="relative w-[60%] bg-emerald-500/15">
        <div
          className="absolute inset-y-0 left-0 rounded-l-full bg-emerald-500/70 transition-all duration-300"
          style={{ width: fillGreen }}
        />
      </div>
      <div className="relative w-[20%] bg-yellow-500/15">
        <div
          className="absolute inset-y-0 left-0 bg-yellow-500/70 transition-all duration-300"
          style={{ width: fillYellow }}
        />
      </div>
      <div className="relative w-[20%] bg-red-500/15">
        <div
          className="absolute inset-y-0 left-0 rounded-r-full bg-red-500/70 transition-all duration-300"
          style={{ width: fillRed }}
        />
      </div>
    </div>
  );

  if (compact) {
    return <div className={className}>{bar}</div>;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`} title={tooltip}>
      <div className="min-w-0 flex-1">{bar}</div>
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{pct}%</span>
    </div>
  );
});
