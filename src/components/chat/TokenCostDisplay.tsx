"use client";

import React from "react";
import { formatTokens } from "@/lib/text/format";

export type TokenCostDisplayProps = {
  /** Input tokens consumed */
  tokensIn?: number;
  /** Output tokens generated */
  tokensOut?: number;
  /** Cache hit rate as a decimal (0–1) */
  cacheHitRate?: number;
  className?: string;
};

/**
 * Subtle per-response token/cost display.
 *
 * - "1.2K in · 3.4K out" compact format
 * - Optional cache hit percentage badge
 * - Muted styling, sits below assistant messages
 */
export const TokenCostDisplay = React.memo(function TokenCostDisplay({
  tokensIn,
  tokensOut,
  cacheHitRate,
  className = "",
}: TokenCostDisplayProps) {
  // Nothing to display if no token data
  if (tokensIn == null && tokensOut == null) return null;

  return (
    <div
      className={`flex items-center gap-1.5 font-mono text-[10px] tabular-nums text-muted-foreground/60 ${className}`}
    >
      {tokensIn != null && (
        <span>{formatTokens(tokensIn)} in</span>
      )}
      {tokensIn != null && tokensOut != null && (
        <span className="text-muted-foreground/30">·</span>
      )}
      {tokensOut != null && (
        <span>{formatTokens(tokensOut)} out</span>
      )}
      {cacheHitRate != null && cacheHitRate > 0 && (
        <span className="ml-1 rounded bg-emerald-500/10 px-1 py-px text-emerald-500/70">
          {Math.round(cacheHitRate * 100)}% cache
        </span>
      )}
    </div>
  );
});

/* formatTokenCount replaced by shared formatTokens from @/lib/text/format */
