"use client";

import { memo, useMemo } from "react";
import { AlertCircle, Clock, FileText, Shield } from "lucide-react";
import type { StudioTask } from "@/features/tasks/types";
import { SectionLabel } from "@/components/SectionLabel";
import { formatDurationCompact } from "@/lib/text/time";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TaskHealthSectionProps {
  task: StudioTask;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

type HealthLevel = "good" | "warning" | "critical";

interface HealthIndicator {
  icon: typeof AlertCircle;
  label: string;
  value: string;
  level: HealthLevel;
  detail?: string;
}

const LEVEL_STYLES: Record<HealthLevel, string> = {
  good: "text-emerald-400",
  warning: "text-amber-400",
  critical: "text-destructive",
};

const LEVEL_BG: Record<HealthLevel, string> = {
  good: "bg-emerald-400/10",
  warning: "bg-amber-400/10",
  critical: "bg-destructive/10",
};

// ─── Component ───────────────────────────────────────────────────────────────

export const TaskHealthSection = memo(function TaskHealthSection({
  task,
}: TaskHealthSectionProps) {
  const indicators = useMemo(() => {
    const result: HealthIndicator[] = [];

    // 1. Consecutive errors
    const errors = task.consecutiveErrors ?? 0;
    result.push({
      icon: AlertCircle,
      label: "Consecutive Errors",
      value: String(errors),
      level: errors === 0 ? "good" : errors < 3 ? "warning" : "critical",
      detail:
        errors === 0
          ? "No recent failures"
          : errors < 3
            ? "Some recent failures — monitor"
            : "Multiple failures — investigate",
    });

    // 2. Timeout
    const payload = task.rawCronJob?.payload;
    const timeoutSec =
      payload?.kind === "agentTurn" ? payload.timeoutSeconds : undefined;
    result.push({
      icon: Clock,
      label: "Timeout",
      value: timeoutSec ? formatDurationCompact(timeoutSec * 1000) : "Default",
      level: "good",
      detail: timeoutSec
        ? `Task will be killed after ${formatDurationCompact(timeoutSec * 1000)}`
        : "Using system default timeout",
    });

    // 3. Prompt length
    const promptLen = task.prompt?.length ?? 0;
    result.push({
      icon: FileText,
      label: "Prompt Length",
      value: promptLen > 0 ? `${promptLen.toLocaleString()} chars` : "Empty",
      level:
        promptLen === 0
          ? "warning"
          : promptLen > 10_000
            ? "warning"
            : "good",
      detail:
        promptLen === 0
          ? "No prompt configured"
          : promptLen > 10_000
            ? "Very long prompt — may increase latency"
            : undefined,
    });

    // 4. Session target
    const sessionTarget = task.rawCronJob?.sessionTarget;
    if (sessionTarget) {
      result.push({
        icon: Shield,
        label: "Session",
        value: sessionTarget === "isolated" ? "Isolated" : "Main",
        level: "good",
        detail:
          sessionTarget === "isolated"
            ? "Runs in its own isolated session"
            : "Runs in the agent's main session",
      });
    }

    return result;
  }, [task]);

  // Don't show if everything is default/good and there's nothing interesting
  const hasNotableInfo = indicators.some(
    (i) => i.level !== "good" || i.label === "Consecutive Errors"
  );
  if (!hasNotableInfo) return null;

  return (
    <div className="border-b border-border/40 px-4 py-3">
      <SectionLabel className="mb-2">Health</SectionLabel>
      <div className="grid grid-cols-2 gap-2">
        {indicators.map((indicator) => {
          const Icon = indicator.icon;
          return (
            <div
              key={indicator.label}
              className={`flex items-start gap-2 rounded-lg px-2.5 py-2 ${LEVEL_BG[indicator.level]}`}
              title={indicator.detail}
            >
              <Icon
                className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${LEVEL_STYLES[indicator.level]}`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {indicator.label}
                </div>
                <div
                  className={`text-xs font-semibold ${LEVEL_STYLES[indicator.level]}`}
                >
                  {indicator.value}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
