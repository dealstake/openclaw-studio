/**
 * useRecommendations — Generates routing recommendations from usage data.
 *
 * Wraps the recommendation engine with React memoization and provides
 * a stable interface for the UI. Tracks dismissed recommendations
 * in localStorage to avoid showing them repeatedly.
 */

import { useCallback, useMemo, useState } from "react";
import type { ModelCostBreakdown } from "@/features/usage/lib/costCalculator";
import type { RoutingRule } from "../lib/types";
import {
  generateRecommendations,
  type Recommendation,
  type UsageDataPoint,
} from "../lib/recommendationEngine";

const DISMISSED_KEY = "openclaw:routing:dismissed-recommendations";

function getDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDismissedIds(ids: Set<string>): void {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage full — ignore
  }
}

/**
 * Build UsageDataPoint[] from aggregated cost-by-model data.
 * This is a bridge between the usage data format and the recommendation engine.
 */
function buildUsageData(
  costByModel: Map<string, ModelCostBreakdown>,
  cronSessions: number,
  totalSessions: number,
): UsageDataPoint[] {
  const points: UsageDataPoint[] = [];

  for (const [model, breakdown] of costByModel) {
    // Estimate task type distribution based on session counts
    // In a real implementation, the API would provide per-taskType breakdowns.
    // For now, we distribute proportionally.
    if (cronSessions > 0) {
      const cronRatio = cronSessions / Math.max(totalSessions, 1);
      points.push({
        agentId: "*",
        taskType: "cron",
        model,
        tokensIn: Math.round(breakdown.inputTokens * cronRatio),
        tokensOut: Math.round(breakdown.outputTokens * cronRatio),
        count: Math.round(breakdown.requests * cronRatio),
        totalCostUsd: breakdown.cost * cronRatio,
      });
    }

    // Heartbeat sessions are typically a subset of cron
    const heartbeatRatio = Math.min(cronSessions * 0.3, totalSessions * 0.1) / Math.max(totalSessions, 1);
    if (heartbeatRatio > 0) {
      points.push({
        agentId: "*",
        taskType: "heartbeat",
        model,
        tokensIn: Math.round(breakdown.inputTokens * heartbeatRatio),
        tokensOut: Math.round(breakdown.outputTokens * heartbeatRatio),
        count: Math.max(1, Math.round(breakdown.requests * heartbeatRatio)),
        totalCostUsd: breakdown.cost * heartbeatRatio,
      });
    }

    // Remaining as main sessions
    const mainRatio = 1 - (cronSessions / Math.max(totalSessions, 1)) - heartbeatRatio;
    if (mainRatio > 0) {
      points.push({
        agentId: "*",
        taskType: "main",
        model,
        tokensIn: Math.round(breakdown.inputTokens * mainRatio),
        tokensOut: Math.round(breakdown.outputTokens * mainRatio),
        count: Math.max(1, Math.round(breakdown.requests * mainRatio)),
        totalCostUsd: breakdown.cost * mainRatio,
      });
    }
  }

  return points;
}

export interface UseRecommendationsResult {
  /** Active (non-dismissed) recommendations, sorted by savings */
  recommendations: Recommendation[];
  /** Total number including dismissed */
  totalCount: number;
  /** Number of new (non-dismissed) recommendations */
  newCount: number;
  /** Dismiss a recommendation (persisted in localStorage) */
  dismiss: (id: string) => void;
  /** Clear all dismissals */
  resetDismissals: () => void;
}

export function useRecommendations(
  rules: RoutingRule[],
  costByModel: Map<string, ModelCostBreakdown>,
  cronSessions: number,
  totalSessions: number,
  timeframeDays?: number,
): UseRecommendationsResult {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(getDismissedIds);

  const usageData = useMemo(
    () => buildUsageData(costByModel, cronSessions, totalSessions),
    [costByModel, cronSessions, totalSessions],
  );

  const allRecommendations = useMemo(
    () => generateRecommendations(usageData, rules, timeframeDays),
    [usageData, rules, timeframeDays],
  );

  // Filter by title (not ID, since IDs regenerate) to persist dismissals
  const recommendations = useMemo(
    () => allRecommendations.filter((r) => !dismissedIds.has(r.title)),
    [allRecommendations, dismissedIds],
  );

  const dismiss = useCallback((id: string) => {
    // Find the recommendation and dismiss by title for stability
    const rec = allRecommendations.find((r) => r.id === id);
    const key = rec?.title ?? id;
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(key);
      saveDismissedIds(next);
      return next;
    });
  }, [allRecommendations]);

  const resetDismissals = useCallback(() => {
    setDismissedIds(new Set());
    saveDismissedIds(new Set());
  }, []);

  return {
    recommendations,
    totalCount: allRecommendations.length,
    newCount: recommendations.length,
    dismiss,
    resetDismissals,
  };
}
