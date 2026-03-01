"use client";

import { memo, useState, useCallback } from "react";
import {
  ChevronRight,
  Terminal,
  Cpu,
  Clock,
  Activity,
  Code2,
  Bot,
} from "lucide-react";
import type { ExternalAgent, ExternalAgentType } from "@/features/external-agents/lib/types";
import { EXTERNAL_AGENT_TYPE_META } from "@/features/external-agents/lib/types";

// ── Status config ──────────────────────────────────────────────────────────

const STATUS_DOT: Record<ExternalAgent["status"], string> = {
  running: "bg-emerald-400 animate-pulse",
  idle: "bg-amber-400",
  stopped: "bg-muted-foreground/30",
};

const STATUS_LABEL: Record<ExternalAgent["status"], string> = {
  running: "Running",
  idle: "Idle",
  stopped: "Stopped",
};

// ── Type icon ──────────────────────────────────────────────────────────────

function AgentTypeIcon({ type, className }: { type: ExternalAgentType; className?: string }) {
  switch (type) {
    case "claude-code":
      return <Terminal className={className} />;
    case "cursor":
      return <Code2 className={className} />;
    case "codex":
      return <Cpu className={className} />;
    case "opencode":
      return <Activity className={className} />;
    default:
      return <Bot className={className} />;
  }
}

// ── Elapsed time ───────────────────────────────────────────────────────────

function formatElapsed(startedAt: number): string {
  const diffMs = Date.now() - startedAt;
  const diffSec = Math.floor(diffMs / 1_000);
  if (diffSec < 60) return `${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ${diffSec % 60}s`;
  const diffHr = Math.floor(diffMin / 60);
  return `${diffHr}h ${diffMin % 60}m`;
}

// ── Card ───────────────────────────────────────────────────────────────────

interface ExternalAgentCardProps {
  agent: ExternalAgent;
}

/**
 * Compact card displaying a single external agent process:
 * - Agent type icon + label
 * - Status dot + label
 * - Elapsed time since detection
 * - PID + workdir metadata
 * - Expandable output snippet
 */
export const ExternalAgentCard = memo(function ExternalAgentCard({
  agent,
}: ExternalAgentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = EXTERNAL_AGENT_TYPE_META[agent.type];
  const hasOutput = Boolean(agent.output);

  const handleToggleExpand = useCallback(() => setExpanded((v) => !v), []);

  return (
    <div
      className="group/agent-card rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40"
      data-testid={`external-agent-card-${agent.id}`}
    >
      <div className="flex gap-2.5">
        {/* Type icon */}
        <div className="flex-shrink-0 pt-0.5">
          <AgentTypeIcon
            type={agent.type}
            className={`h-4 w-4 ${meta.colorClass}`}
          />
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Header row: name + status + expand */}
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-medium text-foreground transition-colors group-hover/agent-card:text-primary">
              {meta.label}
            </span>

            {/* Status dot */}
            <span
              role="status"
              aria-label={`Status: ${STATUS_LABEL[agent.status]}`}
              className={`inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${STATUS_DOT[agent.status]}`}
            />

            {/* Status label */}
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {STATUS_LABEL[agent.status]}
            </span>

            {/* Expand toggle (only when there's output) */}
            {hasOutput && (
              <button
                type="button"
                onClick={handleToggleExpand}
                aria-expanded={expanded}
                aria-label={expanded ? `Collapse ${meta.label} output` : `Expand ${meta.label} output`}
                className="ml-auto flex min-h-[44px] min-w-[44px] items-center justify-center gap-0.5 rounded-md px-1 py-0.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              >
                <ChevronRight
                  size={12}
                  className={`transition-transform ${expanded ? "rotate-90" : ""}`}
                />
                <span className="text-[10px]">{expanded ? "Less" : "More"}</span>
              </button>
            )}
          </div>

          {/* Output snippet (collapsed) */}
          {!expanded && hasOutput && (
            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
              {agent.output}
            </p>
          )}

          {/* Full output (expanded) */}
          {expanded && hasOutput && (
            <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-[11px] font-mono text-foreground/80">
              {agent.output}
            </pre>
          )}

          {/* Metadata row: elapsed + PID + workdir */}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <span
              className="flex items-center gap-0.5"
              aria-label={`Running for ${formatElapsed(agent.startedAt)}`}
            >
              <Clock size={10} aria-hidden="true" />
              {formatElapsed(agent.startedAt)}
            </span>

            {agent.pid !== undefined && (
              <span className="font-mono" aria-label={`Process ID ${agent.pid}`}>
                PID {agent.pid}
              </span>
            )}

            {agent.workdir && (
              <span className="truncate font-mono" title={agent.workdir}>
                {agent.workdir.replace(/^.*\/([^/]+\/[^/]+)$/, "$1")}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
