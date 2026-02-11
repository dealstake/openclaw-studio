"use client";

import { memo } from "react";
import { Zap, Clock, Calendar, Bot, FileText } from "lucide-react";
import type { WizardTaskConfig } from "@/features/tasks/types";
import { humanReadableSchedule } from "@/features/tasks/lib/schedule";

// ─── Props ───────────────────────────────────────────────────────────────────

interface TaskPreviewCardProps {
  config: WizardTaskConfig;
  onConfirm: () => void;
  onAdjust: () => void;
  busy?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_META: Record<
  string,
  { icon: typeof Zap; label: string; color: string }
> = {
  constant: {
    icon: Zap,
    label: "Constant",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  periodic: {
    icon: Clock,
    label: "Periodic",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  },
  scheduled: {
    icon: Calendar,
    label: "Scheduled",
    color: "bg-violet-500/10 text-violet-400 border-violet-500/30",
  },
};

function getScheduleLabel(config: WizardTaskConfig): string {
  try {
    return humanReadableSchedule(config.schedule);
  } catch {
    return "Custom schedule";
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TaskPreviewCard = memo(function TaskPreviewCard({
  config,
  onConfirm,
  onAdjust,
  busy,
}: TaskPreviewCardProps) {
  const meta = TYPE_META[config.type] ?? TYPE_META.periodic;
  const Icon = meta.icon;
  const scheduleLabel = getScheduleLabel(config);

  return (
    <div className="my-3 rounded-xl border border-border bg-card/90 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] ${meta.color}`}
          >
            <Icon className="h-3 w-3" />
            {meta.label}
          </span>
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Task Preview
          </span>
        </div>
        <h3 className="mt-1.5 text-sm font-semibold text-foreground">
          {config.name}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {config.description}
        </p>
      </div>

      {/* Details */}
      <div className="space-y-2 px-4 py-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 shrink-0" />
          <span>{scheduleLabel}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Bot className="h-3.5 w-3.5 shrink-0" />
          <span>Agent: {config.agentId}</span>
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground">
          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-2">{config.prompt.slice(0, 120)}…</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-border/40 px-4 py-3">
        <button
          type="button"
          className="flex h-8 items-center gap-1.5 rounded-md border border-primary/40 bg-primary/10 px-4 text-xs font-semibold text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onConfirm}
          disabled={busy}
        >
          {busy ? "Creating…" : "Create Task"}
        </button>
        <button
          type="button"
          className="flex h-8 items-center rounded-md border border-border/80 bg-card/70 px-3 text-xs text-muted-foreground transition hover:bg-muted/65 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onAdjust}
          disabled={busy}
        >
          Adjust
        </button>
      </div>
    </div>
  );
});
