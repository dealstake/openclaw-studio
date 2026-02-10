"use client";

import { memo, useMemo } from "react";
import type { ChannelsStatusSnapshot, ChannelHealth } from "@/lib/gateway/channels";
import { resolveChannelLabel, resolveChannelHealth } from "@/lib/gateway/channels";

type ChannelStatusPillsProps = {
  snapshot: ChannelsStatusSnapshot | null;
  loading: boolean;
};

const DOT_CLASS: Record<ChannelHealth, string> = {
  connected: "bg-emerald-500",
  running: "bg-yellow-500",
  configured: "bg-muted-foreground/50",
  error: "bg-destructive",
  off: "bg-muted-foreground/30",
};

const abbreviate = (label: string): string => {
  if (label.length <= 4) return label;
  return label.slice(0, 3).toUpperCase();
};

export const ChannelStatusPills = memo(function ChannelStatusPills({
  snapshot,
  loading,
}: ChannelStatusPillsProps) {
  const entries = useMemo(() => {
    if (!snapshot?.channels) return [];
    const channels = snapshot.channels;
    const order = snapshot.channelOrder ?? Object.keys(channels);
    return order
      .map((key) => {
        const entry = channels[key];
        const health = resolveChannelHealth(entry);
        if (health === "off") return null;
        const label = resolveChannelLabel(snapshot, key);
        return { key, label, health };
      })
      .filter(Boolean) as Array<{ key: string; label: string; health: ChannelHealth }>;
  }, [snapshot]);

  if (loading || entries.length === 0) return null;

  return (
    <div className="flex items-center gap-1.5">
      {entries.map((entry) => (
        <span
          key={entry.key}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] border border-border/70 bg-card/65 text-muted-foreground"
          title={`${entry.label}: ${entry.health}`}
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${DOT_CLASS[entry.health]}`} />
          {abbreviate(entry.label)}
        </span>
      ))}
    </div>
  );
});
