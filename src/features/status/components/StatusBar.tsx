"use client";

import { memo, useEffect, useState } from "react";

type StatusBarProps = {
  gatewayVersion?: string;
  gatewayUptime?: number;
  agentCount: number;
  sessionCount: number;
  channelCount: number;
  visible: boolean;
};

const formatUptime = (startedAtMs: number): string => {
  const elapsed = Math.max(0, Date.now() - startedAtMs);
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  if (hours < 24) return `${hours}h ${remainingMins}m`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
};

const Separator = () => (
  <span className="text-muted-foreground/40">·</span>
);

export const StatusBar = memo(function StatusBar({
  gatewayVersion,
  gatewayUptime,
  agentCount,
  sessionCount,
  channelCount,
  visible,
}: StatusBarProps) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!visible || !gatewayUptime) return;
    const interval = setInterval(() => setTick((prev) => prev + 1), 30_000);
    return () => clearInterval(interval);
  }, [visible, gatewayUptime]);

  if (!visible) return null;

  return (
    <div className="glass-panel px-4 py-1.5" data-testid="gateway-status-bar">
      <div className="flex items-center gap-3 font-mono text-[9px] font-semibold uppercase tracking-[0.14em]">
        {gatewayVersion ? (
          <>
            <span className="text-muted-foreground">
              Version{" "}
              <span className="text-foreground">{gatewayVersion}</span>
            </span>
            <Separator />
          </>
        ) : null}
        {gatewayUptime ? (
          <>
            <span className="text-muted-foreground">
              Uptime{" "}
              <span className="text-foreground">{formatUptime(gatewayUptime)}</span>
            </span>
            <Separator />
          </>
        ) : null}
        <span className="text-muted-foreground">
          Agents{" "}
          <span className="text-foreground">{agentCount}</span>
        </span>
        <Separator />
        <span className="text-muted-foreground">
          Sessions{" "}
          <span className="text-foreground">{sessionCount}</span>
        </span>
        <Separator />
        <span className="text-muted-foreground">
          Channels{" "}
          <span className="text-foreground">{channelCount}</span>
        </span>
      </div>
    </div>
  );
});
