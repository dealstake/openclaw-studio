"use client";

import { memo, useCallback, useState } from "react";
import { Plus, RefreshCw, Route } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { SectionLabel } from "@/components/SectionLabel";
import { ErrorBanner } from "@/components/ErrorBanner";
import { Skeleton } from "@/components/Skeleton";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import type { AgentState } from "@/features/agents/state/store";
import { useUsageQuery } from "@/features/usage/hooks/useUsageQuery";
import type { RoutingRule } from "../lib/types";
import { useRoutingRules } from "../hooks/useRoutingRules";
import { useRecommendations } from "../hooks/useRecommendations";
import { RuleRow } from "./RuleRow";
import { RuleEditor } from "./RuleEditor";
import { RecommendationsSection } from "./RecommendationCard";

interface RoutingPanelProps {
  client: GatewayClient;
  status: GatewayStatus;
  models: GatewayModelChoice[];
  agents: AgentState[];
  /** Navigate to Playground tab with a model pre-selected */
  onTestInPlayground?: (model: string) => void;
}

/** Derive a short model display name from its key */
function modelLabel(models: GatewayModelChoice[], modelKey: string): string {
  const match = models.find(
    (m) => `${m.provider}/${m.id}` === modelKey || m.id === modelKey,
  );
  if (!match) {
    // Fall back to the last segment of the model key
    const parts = modelKey.split("/");
    return parts[parts.length - 1] ?? modelKey;
  }
  // Truncate long model names: "claude-haiku-3-5" → "haiku-3-5"
  const shortName = match.name
    .replace(/^claude-/i, "")
    .replace(/^gemini-/i, "")
    .replace(/^gpt-/i, "");
  return shortName || match.name;
}

export const RoutingPanel = memo(function RoutingPanel({
  client,
  status,
  models,
  agents,
  onTestInPlayground,
}: RoutingPanelProps) {
  const {
    rules,
    loading,
    saving,
    error,
    reload,
    createRule,
    editRule,
    removeRule,
  } = useRoutingRules(client, status);

  // Usage data for recommendations
  const { costByModel, totalSessions, cronBreakdown } = useUsageQuery();
  const cronSessions = cronBreakdown.reduce((sum, c) => sum + c.runs, 0);

  const {
    recommendations,
    newCount: recommendationCount,
    dismiss: dismissRecommendation,
  } = useRecommendations(rules, costByModel, cronSessions, totalSessions);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);

  const agentIds = agents.map((a) => a.agentId);

  const handleNewRule = useCallback(() => {
    setEditingRule(null);
    setEditorOpen(true);
  }, []);

  const handleEditRule = useCallback((rule: RoutingRule) => {
    setEditingRule(rule);
    setEditorOpen(true);
  }, []);

  const handleSaveRule = useCallback(
    async (rule: RoutingRule) => {
      if (editingRule) {
        const { id, ...updates } = rule;
        void id; // id is stable, only updates applied
        await editRule(editingRule.id, updates);
      } else {
        await createRule(rule);
      }
    },
    [editingRule, editRule, createRule],
  );

  const handleToggle = useCallback(
    (id: string, enabled: boolean) => {
      void editRule(id, { enabled });
    },
    [editRule],
  );

  const handleDelete = useCallback(
    (id: string) => {
      void removeRule(id);
    },
    [removeRule],
  );

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-2">
          <SectionLabel>Model Router</SectionLabel>
          {recommendationCount > 0 && (
            <span
              className="flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white"
              aria-label={`${recommendationCount} new suggestions`}
              role="status"
            >
              {recommendationCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            onClick={() => void reload()}
            aria-label="Refresh routing rules"
            disabled={loading || saving}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "motion-safe:animate-spin" : ""}`} />
          </IconButton>
          <IconButton
            variant="primary"
            onClick={handleNewRule}
            aria-label="Add routing rule"
            disabled={status !== "connected" || saving}
          >
            <Plus className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {error && (
          <ErrorBanner
            message={error}
            onRetry={() => void reload()}
            className="mb-3"
          />
        )}

        {/* Recommendations */}
        <RecommendationsSection
          recommendations={recommendations}
          onCreateRule={createRule}
          onDismiss={dismissRecommendation}
          onTestInPlayground={onTestInPlayground}
          disabled={status !== "connected" || saving}
        />

        {recommendations.length > 0 && rules.length > 0 && (
          <div className="my-3 border-t border-border/20" />
        )}

        {loading && rules.length === 0 ? (
          <div className="flex flex-col gap-2">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : rules.length === 0 ? (
          <EmptyRules onAdd={handleNewRule} disabled={status !== "connected"} />
        ) : (
          <div className="flex flex-col gap-2">
            {rules.map((rule) => (
              <RuleRow
                key={rule.id}
                rule={rule}
                modelLabel={modelLabel(models, rule.model)}
                onToggle={handleToggle}
                onEdit={handleEditRule}
                onDelete={handleDelete}
                disabled={saving}
              />
            ))}

            {/* Add rule button at bottom of list */}
            <button
              type="button"
              onClick={handleNewRule}
              disabled={status !== "connected" || saving}
              className="mt-1 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/50 py-2.5 text-[12px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-3 w-3" aria-hidden />
              Add rule
            </button>
          </div>
        )}

        {/* Info footer */}
        {rules.length > 0 && (
          <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
            Rules are evaluated top-to-bottom. The first matching rule wins.
            Disable a rule without deleting it using the toggle.
          </p>
        )}
      </div>

      {/* Rule editor sheet */}
      <RuleEditor
        key={`${String(editorOpen)}-${editingRule?.id ?? "new"}`}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        rule={editingRule}
        models={models}
        agentIds={agentIds}
        onSave={handleSaveRule}
        saving={saving}
      />
    </div>
  );
});

function EmptyRules({
  onAdd,
  disabled,
}: {
  onAdd: () => void;
  disabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/40">
        <Route className="h-5 w-5 text-muted-foreground/60" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">No routing rules</p>
        <p className="mt-1 max-w-[240px] text-[12px] text-muted-foreground leading-relaxed">
          Route cron jobs, sub-agents, and heartbeats to cheaper models to cut
          token costs by up to 10×.
        </p>
      </div>
      <button
        type="button"
        onClick={onAdd}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Add your first rule
      </button>
    </div>
  );
}
