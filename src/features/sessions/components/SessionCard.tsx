"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { Archive, ChevronDown, ChevronRight, Clock, GitFork, ListTree, MessageCircle, Radio, Trash2 } from "lucide-react";
import type { SessionEntry } from "./SessionsPanel";
import { UsageDetails, UsageSkeleton, type SessionUsageData } from "./UsageDetails";
import { humanizeSessionKey, humanizeOriginLabel, inferSessionType } from "@/features/sessions/lib/sessionKeyUtils";
import { formatTokens, formatCost } from "@/lib/text/format";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError, parseAgentIdFromSessionKey } from "@/lib/gateway/GatewayClient";
import { parseUsageResult } from "@/features/sessions/hooks/useSessionUsage";
import { formatRelativeTime } from "@/lib/text/time";
import { PanelIconButton } from "@/components/PanelIconButton";

import { sectionLabelClass } from "@/components/SectionLabel";

const SESSION_TYPE_ICON: Record<string, { icon: typeof MessageCircle; label: string }> = {
  main: { icon: MessageCircle, label: "Main session" },
  cron: { icon: Clock, label: "Cron run" },
  subagent: { icon: GitFork, label: "Sub-agent" },
  channel: { icon: Radio, label: "Channel session" },
};

export const SessionCard = memo(function SessionCard({
  session,
  isActive,
  isExpanded,
  onToggle,
  onSessionClick,
  client,
  busyKey,
  confirmDeleteKey,
  onSetConfirmDelete,
  onDelete,
  onCompact,
  onViewTrace,
}: {
  session: SessionEntry;
  isActive: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  onSessionClick?: (sessionKey: string, agentId: string | null) => void;
  client: GatewayClient;
  busyKey: string | null;
  confirmDeleteKey: string | null;
  onSetConfirmDelete: (key: string | null) => void;
  onDelete: (key: string) => void;
  onCompact: (key: string) => void;
  onViewTrace?: (sessionKey: string, agentId: string | null) => void;
}) {
  const [usage, setUsage] = useState<SessionUsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageLoaded, setUsageLoaded] = useState(false);

  const agentId = parseAgentIdFromSessionKey(session.key);
  const sessionType = inferSessionType(session.key);
  const typeInfo = SESSION_TYPE_ICON[sessionType];
  const isBusy = busyKey === session.key;
  const isConfirming = confirmDeleteKey === session.key;

  const loadUsage = useCallback(async () => {
    if (usageLoaded) return;
    setUsageLoading(true);
    try {
      const result = await client.call<{
        totals?: { input?: number; output?: number; totalTokens?: number; totalCost?: number };
        sessions?: Array<{ usage?: { messageCounts?: { total?: number } } }>;
      }>("sessions.usage", { key: session.key });
      setUsage(parseUsageResult(result));
      setUsageLoaded(true);
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        console.error("Failed to load session usage.", err);
      }
    } finally {
      setUsageLoading(false);
    }
  }, [client, session.key, usageLoaded]);

  useEffect(() => {
    if (isExpanded && !usageLoaded) {
      void loadUsage();
    }
  }, [isExpanded, usageLoaded, loadUsage]);

  return (
    <div
      className={`group/session rounded-md border transition-all duration-200 ${
        isActive
          ? "border-primary/40 bg-card/90 shadow-sm"
          : "border-border/80 bg-card/70 hover:border-border hover:bg-muted/55"
      }`}
    >
      <div
        role="button"
        tabIndex={0}
        className="flex cursor-pointer items-start gap-2 p-3"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("[data-action]")) return;
          onToggle();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <div className="mt-0.5 flex flex-shrink-0 items-center gap-1 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
          {typeInfo && (
            <span title={typeInfo.label}>
              <typeInfo.icon className="h-3.5 w-3.5" aria-label={typeInfo.label} />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isActive && (
              <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
            )}
            <span
              className={`truncate sm:truncate ${sectionLabelClass} text-foreground max-sm:line-clamp-2 max-sm:whitespace-normal`}
              title={humanizeSessionKey(session.displayName ?? session.key)}
            >
              {humanizeSessionKey(session.displayName ?? session.key)}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            {agentId ? <span>Agent: {agentId}</span> : null}
            <span>{formatRelativeTime(session.updatedAt)}</span>
            {session.origin?.label ? (
              <span className="max-w-[140px] truncate rounded border border-border/70 bg-muted px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {humanizeOriginLabel(session.origin.label)}
              </span>
            ) : null}
          </div>
          {!isExpanded && usage && (
            <div className="mt-0.5 text-[10px] text-muted-foreground/70">
              {formatTokens(usage.inputTokens)} in · {formatTokens(usage.outputTokens)} out
              {usage.totalCost !== null ? ` · ${formatCost(usage.totalCost, usage.currency)}` : ""}
            </div>
          )}
        </div>

        {!isConfirming && (
          <div
            data-action="true"
            className="flex items-center gap-1 opacity-0 transition group-focus-within/session:opacity-100 group-hover/session:opacity-100"
          >
            {onSessionClick && (
              <button
                className="flex h-7 items-center rounded-md border border-border/80 bg-card/70 px-2 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground transition hover:border-border hover:bg-muted/65"
                type="button"
                onClick={() => onSessionClick(session.key, agentId)}
              >
                View
              </button>
            )}
            {onViewTrace && (
              <PanelIconButton
                aria-label={`View trace for session ${session.key}`}
                onClick={() => onViewTrace(session.key, agentId)}
              >
                <ListTree className="h-3.5 w-3.5" />
              </PanelIconButton>
            )}
            <PanelIconButton
              aria-label={`Compact session ${session.key}`}
              onClick={() => onCompact(session.key)}
              disabled={isBusy}
            >
              <Archive className="h-3.5 w-3.5" />
            </PanelIconButton>
            <PanelIconButton
              variant="destructive"
              aria-label={`Delete session ${session.key}`}
              onClick={() => onSetConfirmDelete(session.key)}
              disabled={isBusy}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </PanelIconButton>
          </div>
        )}
      </div>

      {isConfirming && (
        <div className="flex items-center gap-2 px-3 pb-3" data-action="true">
          <span className="text-[11px] text-muted-foreground">Are you sure?</span>
          <button
            className={`rounded-md border border-destructive/50 bg-transparent px-2 py-1 ${sectionLabelClass} text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60`}
            type="button"
            onClick={() => onDelete(session.key)}
            disabled={isBusy}
          >
            {isBusy ? "Deleting…" : "Confirm"}
          </button>
          <button
            className={`rounded-md border border-border/80 bg-card/70 px-2 py-1 ${sectionLabelClass} text-muted-foreground transition hover:border-border hover:bg-muted/65`}
            type="button"
            onClick={() => onSetConfirmDelete(null)}
            disabled={isBusy}
          >
            Cancel
          </button>
        </div>
      )}

      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? "max-h-[200px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="border-t border-border/40 px-3 pb-3 pt-1">
          {usageLoading && !usage ? <UsageSkeleton /> : null}
          {usage ? <UsageDetails usage={usage} /> : null}
          {!usageLoading && !usage && usageLoaded ? (
            <div className="mt-2 text-[11px] text-muted-foreground">No usage data available.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
});
