"use client";

import { memo } from "react";
import { RefreshCw } from "lucide-react";
import type { ChannelsStatusSnapshot } from "@/lib/gateway/channels";
import { resolveChannelLabel, resolveChannelHealth, type ChannelHealth } from "@/lib/gateway/channels";

type ChannelsPanelProps = {
  snapshot: ChannelsStatusSnapshot | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

const HEALTH_COLORS: Record<ChannelHealth, string> = {
  connected: "bg-primary",
  running: "bg-accent",
  configured: "bg-muted-foreground/50",
  error: "bg-destructive",
  off: "bg-muted-foreground/30",
};

const HEALTH_LABELS: Record<ChannelHealth, string> = {
  connected: "Connected",
  running: "Running",
  configured: "Configured",
  error: "Error",
  off: "Off",
};

export const ChannelsPanel = memo(function ChannelsPanel({
  snapshot,
  loading,
  error,
  onRefresh,
}: ChannelsPanelProps) {
  const channels = snapshot?.channels ?? {};
  const keys = Object.keys(channels).filter((key) => {
    const entry = channels[key];
    return entry?.configured || entry?.running || entry?.connected;
  });

  return (
    <div className="flex h-full w-full flex-col p-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Channels
        </div>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Refresh channels"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error ? (
        <div className="mt-3 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
          {error}
        </div>
      ) : null}

      <div className="mt-3 flex flex-1 flex-col gap-2 overflow-y-auto">
        {loading && keys.length === 0 ? (
          <div className="text-[11px] text-muted-foreground">Loading channels…</div>
        ) : keys.length === 0 ? (
          <div className="text-[11px] text-muted-foreground">No channels configured.</div>
        ) : (
          keys.map((key) => {
            const entry = channels[key];
            const health = resolveChannelHealth(entry);
            const label = resolveChannelLabel(snapshot, key);
            return (
              <div
                key={key}
                className="group/cron flex items-start justify-between gap-2 rounded-md border border-border/80 bg-card/75 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${HEALTH_COLORS[health]}`} />
                    <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                      {label}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {HEALTH_LABELS[health]}
                  </div>
                  {entry?.lastError ? (
                    <div className="mt-1 truncate text-[11px] text-destructive">
                      {entry.lastError}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});
