"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { Archive, RefreshCw, Trash2 } from "lucide-react";
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

type SessionsPanelProps = {
  client: GatewayClient;
  sessions: SessionEntry[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onSessionClick?: (sessionKey: string, agentId: string | null) => void;
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
  // Pattern: agent:<name>:<type>[:<id>]
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
      // Channel-based sessions like googlechat:group:spaces/...
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

/** Handle gateway-style keys like "webchat:g-agent-alex-main" or raw display names */
function humanizeFallbackKey(key: string): string {
  // Gateway display name pattern: "WEBCHAT:G-AGENT-<NAME>-MAIN"
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

  // Gateway channel pattern: "GOOGLECHAT:G-SPACES-XXXX" / "GOOGLECHAT:G-USERS-XXXX"
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

  // Cron job pattern: "CRON: <name>"
  if (/^cron:\s*/i.test(key)) {
    return key.replace(/^cron:\s*/i, "Cron: ");
  }

  // Last resort: clean up common prefixes and make readable
  return key
    .replace(/^(webchat|telegram|discord|whatsapp|signal|googlechat|slack|imessage):/i, (_, ch) => {
      const label = CHANNEL_TYPE_LABELS[ch.toLowerCase()];
      return label ? `${label}: ` : `${ch}: `;
    })
    .replace(/^G-/i, "");
}

function humanizeOriginLabel(label: string): string {
  // e.g. "GOOGLECHAT:GROUP:SPACES/S_MOKSAAAAE" → extract channel type
  const lower = label.toLowerCase();
  for (const [key, name] of Object.entries(CHANNEL_TYPE_LABELS)) {
    if (lower.startsWith(key)) return name;
  }
  return label;
}

export const SessionsPanel = memo(function SessionsPanel({
  client,
  sessions,
  loading,
  error,
  onRefresh,
  onSessionClick,
}: SessionsPanelProps) {
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [sessions]
  );

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
    <div className="flex h-full w-full flex-col overflow-hidden">
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
          <div className="text-[11px] text-muted-foreground">Loading sessions…</div>
        ) : null}

        {!loading && !error && sorted.length === 0 ? (
          <EmptyStatePanel title="No sessions found." compact className="p-3 text-xs" />
        ) : null}

        {sorted.length > 0 ? (
          <div className="flex flex-col gap-2">
            {sorted.map((session) => {
              const agentId = parseAgentIdFromSessionKey(session.key);
              const isBusy = busyKey === session.key;
              const isConfirming = confirmDeleteKey === session.key;

              return (
                <div
                  key={session.key}
                  role={onSessionClick ? "button" : undefined}
                  tabIndex={onSessionClick ? 0 : undefined}
                  className={`group/session rounded-md border border-border/80 bg-card/70 p-3${onSessionClick ? " cursor-pointer transition hover:border-border hover:bg-muted/55" : ""}`}
                  onClick={() => {
                    if (onSessionClick) onSessionClick(session.key, agentId);
                  }}
                  onKeyDown={(e) => {
                    if (onSessionClick && (e.key === "Enter" || e.key === " ")) {
                      e.preventDefault();
                      onSessionClick(session.key, agentId);
                    }
                  }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                        {humanizeSessionKey(session.displayName ?? session.key)}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {agentId ? <span>Agent: {agentId}</span> : null}
                        <span>{formatRelativeTime(session.updatedAt)}</span>
                        {session.origin?.label ? (
                          <span className="max-w-[140px] truncate rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] border border-border/70 bg-muted text-muted-foreground">
                            {humanizeOriginLabel(session.origin.label)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {!isConfirming ? (
                      <div className="flex items-center gap-1 opacity-0 transition group-focus-within/session:opacity-100 group-hover/session:opacity-100">
                        <button
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65 disabled:cursor-not-allowed disabled:opacity-60"
                          type="button"
                          aria-label={`Compact session ${session.key}`}
                          onClick={() => {
                            void handleCompact(session.key);
                          }}
                          disabled={isBusy}
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                        <button
                          className="flex h-7 w-7 items-center justify-center rounded-md border border-destructive/40 bg-transparent text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
                          type="button"
                          aria-label={`Delete session ${session.key}`}
                          onClick={() => setConfirmDeleteKey(session.key)}
                          disabled={isBusy}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : null}
                  </div>
                  {isConfirming ? (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground">Are you sure?</span>
                      <button
                        className="rounded-md border border-destructive/50 bg-transparent px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-destructive transition hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-60"
                        type="button"
                        onClick={() => {
                          void handleDelete(session.key);
                        }}
                        disabled={isBusy}
                      >
                        {isBusy ? "Deleting…" : "Confirm"}
                      </button>
                      <button
                        className="rounded-md border border-border/80 bg-card/70 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:border-border hover:bg-muted/65"
                        type="button"
                        onClick={() => setConfirmDeleteKey(null)}
                        disabled={isBusy}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
});
