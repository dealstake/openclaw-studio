/**
 * RecommendationCard — Displays a proactive routing optimization suggestion.
 *
 * Shows the recommendation title, description, estimated savings, and a
 * one-click "Create Rule" CTA that adds the suggested routing rule.
 * Can be dismissed (persisted via useRecommendations hook).
 */

"use client";

import { memo, useCallback, useState } from "react";
import { Lightbulb, Plus, X, TrendingDown, ArrowRight } from "lucide-react";
import { formatCost } from "@/lib/text/format";
import type { Recommendation } from "../lib/recommendationEngine";
import type { RoutingRule } from "../lib/types";

interface RecommendationCardProps {
  recommendation: Recommendation;
  onCreateRule: (rule: RoutingRule) => Promise<void>;
  onDismiss: (id: string) => void;
  disabled?: boolean;
}

const PRIORITY_STYLES = {
  high: "border-amber-500/30 bg-amber-500/5",
  medium: "border-blue-500/20 bg-blue-500/5",
  low: "border-border/30 bg-muted/20",
} as const;

const PRIORITY_BADGE = {
  high: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  medium: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  low: "bg-muted text-muted-foreground",
} as const;

export const RecommendationCard = memo(function RecommendationCard({
  recommendation,
  onCreateRule,
  onDismiss,
  disabled,
}: RecommendationCardProps) {
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const handleCreate = useCallback(async () => {
    setCreating(true);
    try {
      await onCreateRule(recommendation.suggestedRule);
      setCreated(true);
    } catch {
      // Error handled by parent hook
    } finally {
      setCreating(false);
    }
  }, [onCreateRule, recommendation.suggestedRule]);

  const handleDismiss = useCallback(() => {
    onDismiss(recommendation.id);
  }, [onDismiss, recommendation.id]);

  if (created) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-[12px] text-emerald-600 dark:text-emerald-400">
        <TrendingDown className="h-3.5 w-3.5 shrink-0" />
        <span>
          Rule created: <strong>{recommendation.suggestedRule.name}</strong>
        </span>
      </div>
    );
  }

  return (
    <div
      className={`group relative rounded-lg border p-3 transition-colors ${PRIORITY_STYLES[recommendation.priority]}`}
      role="article"
      aria-label={`Recommendation: ${recommendation.title}`}
    >
      {/* Dismiss button */}
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-2 top-2 rounded-md p-0.5 text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
        aria-label="Dismiss recommendation"
      >
        <X className="h-3 w-3" />
      </button>

      {/* Header */}
      <div className="flex items-start gap-2 pr-5">
        <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="text-[13px] font-medium text-foreground leading-tight">
              {recommendation.title}
            </h4>
            <span
              className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${PRIORITY_BADGE[recommendation.priority]}`}
            >
              {recommendation.priority}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
            {recommendation.description}
          </p>
        </div>
      </div>

      {/* Footer: savings + CTA */}
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
          <TrendingDown className="h-3 w-3" />
          <span className="font-medium">
            ~{formatCost(recommendation.estimatedMonthlySavings)}/mo
          </span>
        </div>

        <button
          type="button"
          onClick={handleCreate}
          disabled={disabled || creating}
          className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating ? (
            "Creating…"
          ) : (
            <>
              <Plus className="h-3 w-3" />
              Create Rule
              <ArrowRight className="h-2.5 w-2.5" />
            </>
          )}
        </button>
      </div>
    </div>
  );
});

// ── Recommendations Section ─────────────────────────────────────────

interface RecommendationsSectionProps {
  recommendations: Recommendation[];
  onCreateRule: (rule: RoutingRule) => Promise<void>;
  onDismiss: (id: string) => void;
  disabled?: boolean;
}

export const RecommendationsSection = memo(function RecommendationsSection({
  recommendations,
  onCreateRule,
  onDismiss,
  disabled,
}: RecommendationsSectionProps) {
  if (recommendations.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">
          Suggestions
        </h3>
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/20 px-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
          {recommendations.length}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {recommendations.map((rec) => (
          <RecommendationCard
            key={rec.id}
            recommendation={rec}
            onCreateRule={onCreateRule}
            onDismiss={onDismiss}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
});
