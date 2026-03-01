"use client";

import { memo, useCallback, useMemo } from "react";
import { Bot, RefreshCw, Loader2 } from "lucide-react";
import { SectionLabel } from "@/components/SectionLabel";
import { PanelIconButton } from "@/components/PanelIconButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorBanner } from "@/components/ErrorBanner";
import { useExternalAgents } from "@/features/external-agents/hooks/useExternalAgents";
import { ExternalAgentCard } from "./ExternalAgentCard";
import type { ExternalAgent } from "@/features/external-agents/lib/types";

// ── Sorting ────────────────────────────────────────────────────────────────

const STATUS_ORDER: Record<ExternalAgent["status"], number> = {
  running: 0,
  idle: 1,
  stopped: 2,
};

function sortAgents(agents: ExternalAgent[]): ExternalAgent[] {
  return [...agents].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
  );
}

// ── Panel ──────────────────────────────────────────────────────────────────

/**
 * External Agents Panel — Phase 1
 *
 * Discovers and displays running external AI coding agent processes
 * (Claude Code, Cursor, Codex, OpenCode) on the current machine.
 * Data is polled every 5s from `GET /api/external-agents`.
 */
export const ExternalAgentsPanel = memo(function ExternalAgentsPanel() {
  const { agents, loading, error, refresh, scannedAt } = useExternalAgents();

  const sorted = useMemo(() => sortAgents(agents), [agents]);

  const runningCount = useMemo(
    () => agents.filter((a) => a.status === "running").length,
    [agents],
  );

  const handleRefresh = useCallback(() => refresh(), [refresh]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <SectionLabel as="span">External Agents</SectionLabel>
          {runningCount > 0 && (
            <span
              aria-label={`${runningCount} running`}
              className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground"
            >
              {runningCount}
            </span>
          )}
        </div>

        <PanelIconButton
          onClick={handleRefresh}
          disabled={loading}
          aria-label="Refresh external agents"
          title="Refresh"
        >
          {loading ? (
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
          ) : (
            <RefreshCw size={14} aria-hidden="true" />
          )}
        </PanelIconButton>
      </div>

      {/* ── Last-scanned timestamp ────────────────────────────────── */}
      {scannedAt !== null && (
        <p className="px-3 pb-1 text-[10px] text-muted-foreground/60">
          Last scan:{" "}
          {new Date(scannedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </p>
      )}

      {/* ── Error banner ─────────────────────────────────────────── */}
      {error && (
        <div className="px-3 pb-2">
          <ErrorBanner message={error} onRetry={handleRefresh} />
        </div>
      )}

      {/* ── Agent list ───────────────────────────────────────────── */}
      <div
        role="list"
        aria-label="Detected external agent processes"
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {!loading && agents.length === 0 && !error && (
          <EmptyState
            icon={Bot}
            title="No external agents detected"
            description="Claude Code, Cursor, Codex, and OpenCode processes appear here when running on this machine."
          />
        )}

        {sorted.map((agent) => (
          <div key={agent.id} role="listitem">
            <ExternalAgentCard agent={agent} />
          </div>
        ))}
      </div>
    </div>
  );
});
