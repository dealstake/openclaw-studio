"use client";

import { memo, useMemo } from "react";
import { Radio, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/CardSkeleton";
import { PanelIconButton } from "@/components/PanelIconButton";
import { ErrorBanner } from "@/components/ErrorBanner";
import type { ChannelsStatusSnapshot } from "@/lib/gateway/channels";
import {
  resolveChannelLabel,
  resolveChannelHealth,
  HEALTH_DOT_COLORS,
  type ChannelHealth,
} from "@/lib/gateway/channels";
import { SectionLabel, sectionLabelClass } from "@/components/SectionLabel";

type ChannelsPanelProps = {
  snapshot: ChannelsStatusSnapshot | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  /** Hide the header when rendered inside PanelExpandModal (which provides its own title) */
  hideHeader?: boolean;
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
    [channels],
  );

  return (
    <div className="flex h-full w-full flex-col p-4">
      <div className="flex items-center justify-between">
        {!hideHeader && <SectionLabel>Channels</SectionLabel>}
        {hideHeader && <span />}
        <PanelIconButton
          aria-label="Refresh channels"
          title="Refresh channels"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </PanelIconButton>
      </div>

      {error && <ErrorBanner message={error} onRetry={onRefresh} className="mt-3" />}

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
          <div className="animate-in fade-in flex flex-col gap-2 duration-300">
            {keys.map((key, chIdx) => {
              const entry = channels[key];
              const health = resolveChannelHealth(entry);
              const label = resolveChannelLabel(snapshot, key);
              return (
                <div
                  key={key}
                  style={{ animationDelay: `${Math.min(chIdx * 50, 300)}ms` }}
                  className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both group/channel flex items-start justify-between gap-2 rounded-md border border-border/80 bg-card/75 px-3 py-2 duration-200 transition-colors hover:bg-muted/30"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 shrink-0 rounded-full ${HEALTH_DOT_COLORS[health]}`}
                      />
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
            })}
          </div>
        )}
      </div>
    </div>
  );
});
