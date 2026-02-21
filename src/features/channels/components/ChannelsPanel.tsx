"use client";

import { memo, useMemo } from "react";
import { Radio, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/CardSkeleton";
import { PanelIconButton } from "@/components/PanelIconButton";
import type { ChannelsStatusSnapshot } from "@/lib/gateway/channels";
import { resolveChannelLabel, resolveChannelHealth, type ChannelHealth } from "@/lib/gateway/channels";
import { SectionLabel, sectionLabelClass} from "@/components/SectionLabel";

type ChannelsPanelProps = {
  snapshot: ChannelsStatusSnapshot | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  /** Hide the header when rendered inside PanelExpandModal (which provides its own title) */
  hideHeader?: boolean;
};

const HEALTH_COLORS: Record<ChannelHealth, string> = {
  connected: "bg-primary",
  running: "bg-accent",
  configured: "bg-amber-500",
  error: "bg-destructive",
  off: "bg-muted-foreground/30",
};

const HEALTH_LABELS: Record<ChannelHealth, string> = {
  connected: "Connected",
  running: "Running",
  configured: "Not connected",
  error: "Error",
  off: "Off",
};

export const ChannelsPanel = memo(function ChannelsPanel({
  snapshot,
  loading,
  error,
  onRefresh,
  hideHeader = false,
}: ChannelsPanelProps) {
  const channels = useMemo(() => snapshot?.channels ?? {}, [snapshot]);
  const keys = useMemo(
    () =>
      Object.keys(channels).filter((key) => {
        const entry = channels[key];
        return entry?.configured || entry?.running || entry?.connected;
      }),
    [channels]
  );

  return (
    <div className="flex h-full w-full flex-col p-4">
      {!hideHeader && (
        <div className="flex items-center justify-between">
          <SectionLabel>
            Channels
          </SectionLabel>
          <PanelIconButton
            aria-label="Refresh channels"
            title="Refresh channels"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </PanelIconButton>
        </div>
      )}

      {hideHeader && (
        <div className="flex items-center justify-end">
          <PanelIconButton
            aria-label="Refresh channels"
            title="Refresh channels"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </PanelIconButton>
        </div>
      )}

      {error ? (
        <div className="mt-3 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
          {error}
        </div>
      ) : null}

      <div className="mt-3 flex flex-1 flex-col gap-2 overflow-y-auto">
        {loading && keys.length === 0 ? (
          <CardSkeleton count={3} variant="list" />
        ) : keys.length === 0 ? (
          <EmptyState
            icon={Radio}
            title="No channels configured"
            description="Connect messaging channels like WhatsApp, Telegram, Discord, or Slack to this agent."
          />
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
                    <span className={`truncate ${sectionLabelClass} text-foreground`}>
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
