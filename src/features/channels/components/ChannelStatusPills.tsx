"use client";

import { memo, useMemo } from "react";
import type { ChannelsStatusSnapshot, ChannelHealth } from "@/lib/gateway/channels";
import { resolveChannelLabel, resolveChannelHealth, HEALTH_PILL_DOT_COLORS } from "@/lib/gateway/channels";
import { abbreviate } from "../lib/abbreviate";

type ChannelStatusPillsProps = {
  snapshot: ChannelsStatusSnapshot | null;
  loading: boolean;
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
          className="inline-flex max-w-[80px] items-center gap-1 truncate rounded border border-border/70 bg-card/65 px-1.5 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          title={`${entry.label}: ${entry.health}`}
        >
          <span
            className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${HEALTH_PILL_DOT_COLORS[entry.health]}`}
          />
          {abbreviate(entry.label)}
        </span>
      ))}
    </div>
  );
});
