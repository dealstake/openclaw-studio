"use client";

import { memo, useCallback, useMemo, useState } from "react";
import { Archive, RefreshCw, Trash2 } from "lucide-react";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { isGatewayDisconnectLikeError, parseAgentIdFromSessionKey } from "@/lib/gateway/GatewayClient";

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
};

const formatRelativeTime = (timestamp: number | null | undefined): string => {
  if (!timestamp) return "—";
  const elapsed = Date.now() - timestamp;
  if (elapsed < 0) return "just now";
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const SessionsPanel = memo(function SessionsPanel({
  client,
  sessions,
  loading,
  error,
  onRefresh,
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
                  className="group/session rounded-md border border-border/80 bg-card/70 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                        {session.displayName ?? session.key}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        {agentId ? <span>Agent: {agentId}</span> : null}
                        <span>{formatRelativeTime(session.updatedAt)}</span>
                        {session.origin?.label ? (
                          <span className="rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] border border-border/70 bg-muted text-muted-foreground">
                            {session.origin.label}
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
