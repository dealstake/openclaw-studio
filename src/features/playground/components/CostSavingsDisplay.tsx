"use client";

import { memo, useMemo } from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { estimateCostUsd, formatCostUsd } from "../lib/costEstimator";

interface CostSavingsDisplayProps {
  /** Model key used for this playground run */
  testedModel: string;
  /** Agent's currently configured model key */
  agentModel: string | null;
  /** Token counts from the playground response */
  tokensIn: number;
  tokensOut: number;
}

/**
 * Shows estimated cost savings (or increase) when comparing the playground
 * model to the agent's currently configured model. Helps users make informed
 * model switching decisions.
 */
export const CostSavingsDisplay = memo(function CostSavingsDisplay({
  testedModel,
  agentModel,
  tokensIn,
  tokensOut,
}: CostSavingsDisplayProps) {
  const comparison = useMemo(() => {
    if (!agentModel || agentModel === testedModel) return null;
    const agentCost = estimateCostUsd(agentModel, tokensIn, tokensOut);
    const testedCost = estimateCostUsd(testedModel, tokensIn, tokensOut);
    if (agentCost === null || testedCost === null) return null;
    if (agentCost === 0 && testedCost === 0) return null;

    const diff = agentCost - testedCost;
    const pct = agentCost > 0 ? (diff / agentCost) * 100 : 0;
    return { agentCost, testedCost, diff, pct };
  }, [agentModel, testedModel, tokensIn, tokensOut]);

  if (!comparison) return null;

  const { diff, pct } = comparison;
  const isSaving = diff > 0;
  const isMore = diff < 0;

  // Extract display-friendly model names
  const agentModelName = agentModel?.split("/").pop() ?? agentModel ?? "";

  return (
    <div
      className={`flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium ${
        isSaving
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : isMore
            ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
            : "bg-muted text-muted-foreground"
      }`}
      title={`vs ${agentModelName}: ${isSaving ? "saves" : isMore ? "costs" : "same"} ${formatCostUsd(Math.abs(diff))} (${Math.abs(pct).toFixed(0)}%)`}
    >
      {isSaving ? (
        <TrendingDown className="h-3 w-3" />
      ) : isMore ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <Minus className="h-3 w-3" />
      )}
      <span>
        {isSaving
          ? `${Math.abs(pct).toFixed(0)}% cheaper`
          : isMore
            ? `${Math.abs(pct).toFixed(0)}% more`
            : "Same cost"}{" "}
        vs {agentModelName}
      </span>
    </div>
  );
});
