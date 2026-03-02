/**
 * SavingsCard — Displays routing cost savings summary.
 *
 * Shows estimated or actual savings from model routing rules,
 * with a per-rule breakdown and savings percentage.
 */

"use client";

import { memo } from "react";
import { TrendingDown, ArrowRight, Sparkles } from "lucide-react";
import { formatCost } from "@/lib/text/format";
import type { SavingsEstimateSummary } from "@/features/routing/lib/savingsEstimator";

interface SavingsCardProps {
  savings: SavingsEstimateSummary;
  className?: string;
}

export const SavingsCard = memo(function SavingsCard({
  savings,
  className,
}: SavingsCardProps) {
  if (savings.byRule.length === 0) {
    return null;
  }

  return (
    <div
      className={`rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3 ${className ?? ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-medium text-foreground">
            Routing Savings
          </h3>
          {savings.isEstimate && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              estimate
            </span>
          )}
        </div>
        <Sparkles className="h-3.5 w-3.5 text-emerald-500/60" />
      </div>

      {/* Main stat */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-emerald-500">
          {formatCost(savings.totalSaved)}
        </span>
        <span className="text-sm text-muted-foreground">
          saved
          {savings.savedPercent > 0 && (
            <span className="ml-1">
              ({savings.savedPercent.toFixed(0)}%)
            </span>
          )}
        </span>
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>
          {savings.byRule.reduce((s, r) => s + r.sessionsAffected, 0)} sessions
          routed
        </span>
        <span>
          {formatCost(savings.totalOriginalCost)} without routing
        </span>
      </div>

      {/* Per-rule breakdown */}
      {savings.byRule.length > 0 && (
        <div className="space-y-1.5 border-t border-emerald-500/10 pt-2">
          {savings.byRule.slice(0, 5).map((rule) => (
            <div
              key={rule.ruleId}
              className="flex items-center justify-between text-xs"
            >
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <ArrowRight className="h-3 w-3" />
                <span className="truncate max-w-[140px]">{rule.ruleName}</span>
              </span>
              <span className="font-medium text-emerald-500">
                {formatCost(rule.savedAmount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
