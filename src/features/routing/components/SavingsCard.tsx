/**
 * SavingsCard — Displays routing cost savings summary.
 *
 * Shows total savings from model routing over a configurable period,
 * with a breakdown by rule and trend indicator.
 */

"use client";

import { memo, useMemo } from "react";
import { TrendingDown, TrendingUp, ArrowRight } from "lucide-react";

interface RoutingDecisionRecord {
  originalModel: string;
  routedModel: string;
  tokensIn: number;
  tokensOut: number;
  savedAmount: number;
  ruleName: string;
  timestamp: number;
}

interface SavingsCardProps {
  /** Routing decisions from the current period */
  decisions: RoutingDecisionRecord[];
  /** Label for the period (e.g., "This Week", "Last 30 Days") */
  periodLabel: string;
  /** Previous period savings for trend calculation */
  previousPeriodSavings?: number;
  className?: string;
}

export const SavingsCard = memo(function SavingsCard({
  decisions,
  periodLabel,
  previousPeriodSavings,
  className,
}: SavingsCardProps) {
  const stats = useMemo(() => {
    const totalSaved = decisions.reduce((sum, d) => sum + d.savedAmount, 0);
    const routedCount = decisions.filter((d) => d.savedAmount > 0).length;
    const totalCount = decisions.length;

    // Group savings by rule name
    const byRule = new Map<string, number>();
    for (const d of decisions) {
      if (d.savedAmount > 0) {
        byRule.set(d.ruleName, (byRule.get(d.ruleName) ?? 0) + d.savedAmount);
      }
    }
    const topRules = [...byRule.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Trend
    const trend =
      previousPeriodSavings != null && previousPeriodSavings > 0
        ? ((totalSaved - previousPeriodSavings) / previousPeriodSavings) * 100
        : null;

    return { totalSaved, routedCount, totalCount, topRules, trend };
  }, [decisions, previousPeriodSavings]);

  if (stats.totalCount === 0) {
    return (
      <div className={`rounded-lg border border-border bg-card p-4 ${className ?? ""}`}>
        <p className="text-sm text-muted-foreground">
          No routing decisions yet. Configure rules in the Router tab to start saving.
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-lg border border-border bg-card p-4 space-y-3 ${className ?? ""}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Routing Savings</h3>
        <span className="text-xs text-muted-foreground">{periodLabel}</span>
      </div>

      {/* Main stat */}
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold text-emerald-500">
          ${stats.totalSaved.toFixed(2)}
        </span>
        <span className="text-sm text-muted-foreground">saved</span>
        {stats.trend != null && (
          <span
            className={`flex items-center gap-0.5 text-xs ${
              stats.trend >= 0 ? "text-emerald-500" : "text-amber-500"
            }`}
          >
            {stats.trend >= 0 ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(stats.trend).toFixed(0)}%
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>{stats.routedCount} routed</span>
        <span>{stats.totalCount} total requests</span>
        <span>
          {stats.totalCount > 0
            ? ((stats.routedCount / stats.totalCount) * 100).toFixed(0)
            : 0}
          % routed
        </span>
      </div>

      {/* Top rules */}
      {stats.topRules.length > 0 && (
        <div className="space-y-1 pt-1 border-t border-border">
          {stats.topRules.map(([name, saved]) => (
            <div key={name} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <ArrowRight className="h-3 w-3" />
                {name}
              </span>
              <span className="text-emerald-500 font-medium">
                ${saved.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
