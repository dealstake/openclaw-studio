/**
 * useRoutingSavings — Estimates cost savings from routing rules
 * using aggregated usage data from useUsageQuery.
 */

import { useMemo } from "react";
import type { ModelCostBreakdown } from "@/features/usage/lib/costCalculator";
import type { RoutingRule } from "../lib/types";
import {
  estimateSavings,
  EMPTY_SUMMARY,
  type SavingsEstimateSummary,
} from "../lib/savingsEstimator";

/**
 * Compute savings estimates from aggregated usage data + routing rules.
 */
export function useRoutingSavings(
  rules: RoutingRule[],
  costByModel: Map<string, ModelCostBreakdown>,
  totalSessions: number,
  totalInputTokens: number,
  totalOutputTokens: number,
  cronSessions: number,
  defaultModel?: string,
): SavingsEstimateSummary {
  return useMemo(() => {
    if (totalSessions === 0 || rules.length === 0) return EMPTY_SUMMARY;
    return estimateSavings(
      rules,
      costByModel,
      totalSessions,
      totalInputTokens,
      totalOutputTokens,
      cronSessions,
      defaultModel,
    );
  }, [rules, costByModel, totalSessions, totalInputTokens, totalOutputTokens, cronSessions, defaultModel]);
}
