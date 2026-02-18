/**
 * Pure cost calculation from raw session data.
 * No React imports — fully testable.
 */

import { getModelPricing, getModelDisplayName } from "./pricingTable";

/** Raw session shape from sessions.list RPC */
export type RawSessionEntry = {
  key: string;
  displayName?: string;
  model?: string;
  modelProvider?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  updatedAt?: number | null;
  origin?: { label?: string | null; provider?: string | null } | null;
};

/** Enriched session with computed cost */
export type SessionCostEntry = {
  key: string;
  displayName: string;
  model: string;
  modelDisplayName: string;
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
  updatedAt: number | null;
  isCron: boolean;
};

/** Per-model aggregation */
export type ModelCostBreakdown = {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
};

/** Full calculation result */
export type CostCalculationResult = {
  entries: SessionCostEntry[];
  totalCost: number;
  costByModel: Map<string, ModelCostBreakdown>;
  totalInputTokens: number;
  totalOutputTokens: number;
};

/**
 * Calculate costs for an array of raw sessions.
 * Sessions with unknown models get `cost: null`.
 */
export function calculateSessionCosts(
  sessions: RawSessionEntry[]
): CostCalculationResult {
  const entries: SessionCostEntry[] = [];
  const costByModel = new Map<string, ModelCostBreakdown>();
  let totalCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const session of sessions) {
    const model = session.model ?? "unknown";
    const inputTokens = session.inputTokens ?? 0;
    const outputTokens = session.outputTokens ?? 0;
    const isCron = session.key.startsWith("cron-");

    const pricing = getModelPricing(model);
    const cost =
      pricing !== null
        ? (inputTokens / 1_000_000) * pricing.inputPer1M +
          (outputTokens / 1_000_000) * pricing.outputPer1M
        : null;

    const modelDisplayName = getModelDisplayName(model);

    entries.push({
      key: session.key,
      displayName: session.displayName ?? session.key,
      model,
      modelDisplayName,
      inputTokens,
      outputTokens,
      cost,
      updatedAt: session.updatedAt ?? null,
      isCron,
    });

    totalInputTokens += inputTokens;
    totalOutputTokens += outputTokens;
    if (cost !== null) {
      totalCost += cost;
    }

    // Aggregate by display name
    const existing = costByModel.get(modelDisplayName);
    if (existing) {
      existing.requests += 1;
      existing.inputTokens += inputTokens;
      existing.outputTokens += outputTokens;
      existing.cost += cost ?? 0;
    } else {
      costByModel.set(modelDisplayName, {
        requests: 1,
        inputTokens,
        outputTokens,
        cost: cost ?? 0,
      });
    }
  }

  return {
    entries,
    totalCost,
    costByModel,
    totalInputTokens,
    totalOutputTokens,
  };
}
