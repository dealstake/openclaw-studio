"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ChevronDown, ChevronRight, RefreshCw, Trash2 } from "lucide-react";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError, parseAgentIdFromSessionKey } from "@/lib/gateway/GatewayClient";
import { formatRelativeTime } from "@/lib/text/time";

export type SessionEntry = {
  key: string;
  updatedAt?: number | null;
  displayName?: string;
  origin?: { label?: string | null } | null;
};

type SessionUsageData = {
  inputTokens: number;
  outputTokens: number;
  totalCost: number | null;
  currency: string;
  messageCount: number;
};

type SessionsPanelProps = {
  client: GatewayClient;
  sessions: SessionEntry[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSessionClick?: (sessionKey: string, agentId: string | null) => void;
  activeSessionKey?: string | null;
};

const CHANNEL_TYPE_LABELS: Record<string, string> = {
  webchat: "Webchat",
  telegram: "Telegram",
  discord: "Discord",
  whatsapp: "WhatsApp",
  signal: "Signal",
  googlechat: "Google Chat",
  slack: "Slack",
  imessage: "iMessage",
};

function humanizeSessionKey(key: string): string {
  const parts = key.split(":");
  if (parts.length < 3) return humanizeFallbackKey(key);
  const type = parts[2];
  const rest = parts.slice(3).join(":");

  switch (type) {
    case "main":
      return "Main Session";
    case "subagent":
      return `Sub-agent ${rest.slice(0, 6)}`;
    case "cron":
      return `Cron ${rest.slice(0, 6)}`;
    default: {
      const channelLabel = CHANNEL_TYPE_LABELS[type.toLowerCase()];
      if (channelLabel) {
        const subtype = parts[3];
        if (subtype === "group") return `${channelLabel} Group`;
        if (subtype === "dm") return `${channelLabel} DM`;
        return channelLabel;
      }
      return humanizeFallbackKey(key);
    }
  }
}

function humanizeFallbackKey(key: string): string {
  const gatewayAgentRe = /^([A-Za-z]+):G-AGENT-([A-Za-z0-9]+)-(.+)$/i;
  const match = key.match(gatewayAgentRe);
  if (match) {
    const channel = CHANNEL_TYPE_LABELS[match[1].toLowerCase()] ?? match[1];
    const agentName = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
    const suffix = match[3].toLowerCase();
    if (suffix === "main") return `${channel} · ${agentName}`;
    if (suffix.startsWith("subagent")) return `${channel} · ${agentName} Sub-agent`;
    return `${channel} · ${agentName} (${suffix.slice(0, 8)})`;
  }

  const gatewayChannelRe = /^([A-Za-z]+):G-(SPACES|USERS|GROUPS|DMS)-(.+)$/i;
  const chanMatch = key.match(gatewayChannelRe);
  if (chanMatch) {
    const channel = CHANNEL_TYPE_LABELS[chanMatch[1].toLowerCase()] ?? chanMatch[1];
    const scope = chanMatch[2].toLowerCase();
    const id = chanMatch[3].slice(0, 8);
    if (scope === "spaces") return `${channel} Space ${id}`;
    if (scope === "users") return `${channel} DM ${id}`;
    if (scope === "groups") return `${channel} Group ${id}`;
    return `${channel} ${scope} ${id}`;
  }

  if (/^cron:\s*/i.test(key)) {
    return key.replace(/^cron:\s*/i, "Cron: ");
  }

  return key
    .replace(/^(webchat|telegram|discord|whatsapp|signal|googlechat|slack|imessage):/i, (_, ch: string) => {
      const label = CHANNEL_TYPE_LABELS[ch.toLowerCase()];
      return label ? `${label}: ` : `${ch}: `;
    })
    .replace(/^G-/i, "");
}

function humanizeOriginLabel(label: string): string {
  const lower = label.toLowerCase();
  for (const [key, name] of Object.entries(CHANNEL_TYPE_LABELS)) {
    if (lower.startsWith(key)) return name;
  }
  return label;
}

function formatCost(cost: number, currency: string): string {
  if (cost < 0.01) {
    return `<$0.01`;
  }
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cost);
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/* ─── Usage detail grid (shown inside expanded card) ─── */
function UsageDetails({ usage }: { usage: SessionUsageData }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5">
      <div className="rounded border border-border/50 bg-muted/30 px-2 py-1">
        <div className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Input
        </div>
        <div className="text-[11px] font-semibold text-foreground">
          {formatTokens(usage.inputTokens)}
        </div>
      </div>
      <div className="rounded border border-border/50 bg-muted/30 px-2 py-1">
        <div className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Output
        </div>
        <div className="text-[11px] font-semibold text-foreground">
          {formatTokens(usage.outputTokens)}
        </div>
      </div>
      <div className="rounded border border-border/50 bg-muted/30 px-2 py-1">
        <div className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Cost
        </div>
        <div className="text-[11px] font-semibold text-foreground">
          {usage.totalCost !== null ? formatCost(usage.totalCost, usage.currency) : "—"}
        </div>
      </div>
      <div className="rounded border border-border/50 bg-muted/30 px-2 py-1">
        <div className="font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Messages
        </div>
        <div className="text-[11px] font-semibold text-foreground">
          {usage.messageCount.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

/* ─── Skeleton for loading usage ─── */
function UsageSkeleton() {
  return (
    <div className="mt-2 grid grid-cols-2 gap-1.5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-[38px] animate-pulse rounded border border-border/50 bg-muted/20" />
      ))}
    </div>
  );
}

/* ─── Single session card ─── */
const SessionCard = memo(function SessionCard({
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
}) {
  const [usage, setUsage] = useState<SessionUsageData | null>(null);
  const [usageLoading, setUsageLoading] = useState(false);
  const [usageLoaded, setUsageLoaded] = useState(false);

  const agentId = parseAgentIdFromSessionKey(session.key);
  const isBusy = busyKey === session.key;
  const isConfirming = confirmDeleteKey === session.key;

  // Load usage when expanded (lazy)
  const loadUsage = useCallback(async () => {
    if (usageLoaded) return;
    setUsageLoading(true);
    try {
      const result = await client.call<{
        totals?: { input?: number; output?: number; totalCost?: number };
        sessions?: Array<{ usage?: { messageCounts?: { total?: number } } }>;
      }>("sessions.usage", { key: session.key });
      const totals = result.totals;
      const firstSession = result.sessions?.[0];
      setUsage({
        inputTokens: totals?.input ?? 0,
        outputTokens: totals?.output ?? 0,
        totalCost: totals?.totalCost != null && totals.totalCost > 0 ? totals.totalCost : null,
        currency: "USD",
        messageCount: firstSession?.usage?.messageCounts?.total ?? 0,
      });
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
      {/* Header row */}
      <div
        role="button"
        tabIndex={0}
        className="flex cursor-pointer items-start gap-2 p-3"
        onClick={(e) => {
          // If clicking action buttons, don't toggle
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
        {/* Expand chevron */}
        <div className="mt-0.5 flex-shrink-0 text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {isActive && (
              <span className="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
            )}
            <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
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
        </div>

        {/* Action buttons */}
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
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              aria-label={`Compact session ${session.key}`}
              onClick={() => onCompact(session.key)}
              disabled={isBusy}
            >
              <Archive className="h-3.5 w-3.5" />
            </button>
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md border border-destructive/40 bg-transparent text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              aria-label={`Delete session ${session.key}`}
              onClick={() => onSetConfirmDelete(session.key)}
              disabled={isBusy}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Confirm delete */}
      {isConfirming && (
        <div className="flex items-center gap-2 px-3 pb-3" data-action="true">
          <span className="text-[11px] text-muted-foreground">Are you sure?</span>
          <button
            className="rounded-md border border-destructive/50 bg-transparent px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={() => onDelete(session.key)}
            disabled={isBusy}
          >
            {isBusy ? "Deleting…" : "Confirm"}
          </button>
          <button
            className="rounded-md border border-border/80 bg-card/70 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:border-border hover:bg-muted/65"
            type="button"
            onClick={() => onSetConfirmDelete(null)}
            disabled={isBusy}
          >
            Cancel
          </button>
        </div>
      )}

      {/* Expanded content with usage */}
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

export const SessionsPanel = memo(function SessionsPanel({
  client,
  sessions,
  loading,
  error,
  onRefresh,
  onSessionClick,
  activeSessionKey = null,
}: SessionsPanelProps) {
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(() => {
    return activeSessionKey ? new Set([activeSessionKey]) : new Set();
  });

  // Keep active session expanded when it changes
  useEffect(() => {
    if (activeSessionKey) {
      setExpandedKeys((prev) => {
        if (prev.has(activeSessionKey)) return prev;
        const next = new Set(prev);
        next.add(activeSessionKey);
        return next;
      });
    }
  }, [activeSessionKey]);

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [sessions]
  );

  const toggleExpanded = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleDelete = useCallback(
    async (key: string) => {
      setBusyKey(key);
      setActionError(null);
      try {
        await client.call("sessions.delete", { key });
        setConfirmDeleteKey(null);
        onRefresh();
      } catch (err) {
        if (!isGatewayDisconnectLikeError(err)) {
          const message = err instanceof Error ? err.message : "Failed to delete session.";
          setActionError(message);
        }
      } finally {
        setBusyKey(null);
      }
    },
    [client, onRefresh]
  );

  const handleCompact = useCallback(
    async (key: string) => {
      setBusyKey(key);
      setActionError(null);
      try {
        await client.call("sessions.compact", { key });
        onRefresh();
      } catch (err) {
        if (!isGatewayDisconnectLikeError(err)) {
          const message = err instanceof Error ? err.message : "Failed to compact session.";
          setActionError(message);
        }
      } finally {
        setBusyKey(null);
      }
    },
    [client, onRefresh]
  );

  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Sessions
        </div>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          aria-label="Refresh sessions"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {error || actionError ? (
          <div className="mb-3 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
            {error ?? actionError}
          </div>
        ) : null}

        {loading && sessions.length === 0 ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[72px] animate-pulse rounded-md border border-border/50 bg-muted/20" />
            ))}
          </div>
        ) : null}

        {!loading && !error && sorted.length === 0 ? (
          <EmptyStatePanel title="No sessions found." compact className="p-3 text-xs" />
        ) : null}

        {sorted.length > 0 ? (
          <div className="flex flex-col gap-2">
            {sorted.map((session) => (
              <SessionCard
                key={session.key}
                session={session}
                isActive={session.key === activeSessionKey}
                isExpanded={expandedKeys.has(session.key)}
                onToggle={() => toggleExpanded(session.key)}
                onSessionClick={onSessionClick}
                client={client}
                busyKey={busyKey}
                confirmDeleteKey={confirmDeleteKey}
                onSetConfirmDelete={setConfirmDeleteKey}
                onDelete={(key) => { void handleDelete(key); }}
                onCompact={(key) => { void handleCompact(key); }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
});
