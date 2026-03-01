"use client";

import { memo } from "react";
import { SectionLabel } from "@/components/SectionLabel";
import type { ParsedGatewaySettings } from "../lib/types";

interface SessionDefaultsSectionProps {
  config: ParsedGatewaySettings;
}

function formatResetMode(mode: string): string {
  if (mode === "daily") return "Daily";
  if (mode === "idle") return "Idle timeout";
  return "Disabled";
}

function formatCompactionMode(mode: string): string {
  if (mode === "default") return "Default";
  if (mode === "safeguard") return "Safeguard";
  return "Not set";
}

export const SessionDefaultsSection = memo(function SessionDefaultsSection({
  config,
}: SessionDefaultsSectionProps) {
  const { session, compaction } = config;

  return (
    <section aria-label="Session Defaults">
      <SectionLabel as="h4" className="mb-2 text-muted-foreground">
        Session Defaults
      </SectionLabel>

      <div className="rounded-md border border-border/80 bg-card/70 p-4 space-y-4">
        {/* Session reset */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-2">
            Session Reset
          </p>
          <div className="rounded-md border border-border/80 bg-card/75 px-3 py-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Mode</span>
              <span className="text-sm text-foreground">
                {formatResetMode(session.mode)}
              </span>
            </div>
            {session.mode === "daily" && session.atHour !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Reset at hour (UTC)
                </span>
                <span className="text-sm text-foreground font-mono">
                  {session.atHour}:00
                </span>
              </div>
            )}
            {session.mode === "idle" && session.idleMinutes !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Idle timeout
                </span>
                <span className="text-sm text-foreground font-mono">
                  {session.idleMinutes} min
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Compaction */}
        <div>
          <p className="text-[11px] font-medium text-muted-foreground mb-2">
            Compaction
          </p>
          <div className="rounded-md border border-border/80 bg-card/75 px-3 py-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">Mode</span>
              <span className="text-sm text-foreground">
                {formatCompactionMode(compaction.mode)}
              </span>
            </div>
            {compaction.reserveTokensFloor !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Reserve tokens floor
                </span>
                <span className="text-sm text-foreground font-mono">
                  {compaction.reserveTokensFloor.toLocaleString()}
                </span>
              </div>
            )}
            {compaction.memoryFlush !== undefined && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Memory flush
                </span>
                <span className="text-sm text-foreground">
                  {compaction.memoryFlush.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
});
