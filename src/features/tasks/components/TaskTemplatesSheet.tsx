"use client";

import { memo, useCallback, useState } from "react";
import { Loader2 } from "lucide-react";
import type { CreateTaskPayload } from "@/features/tasks/types";
import { TASK_TEMPLATES, type TaskTemplate } from "@/features/tasks/lib/templates";
import { humanReadableSchedule } from "@/features/tasks/lib/schedule";
import { TYPE_CONFIG } from "@/features/tasks/lib/taskTypeConfig";

// ─── Props ───────────────────────────────────────────────────────────────────

interface TaskTemplatesSheetProps {
  agents: string[];
  onUseTemplate: (payload: CreateTaskPayload) => Promise<void>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TaskTemplatesSheet = memo(function TaskTemplatesSheet({
  agents,
  onUseTemplate,
}: TaskTemplatesSheetProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const defaultAgent = agents[0] ?? "alex";

  const handleUse = useCallback(
    async (template: TaskTemplate) => {
      setBusyId(template.id);
      try {
        const payload = template.build(defaultAgent);
        await onUseTemplate(payload);
      } finally {
        setBusyId(null);
      }
    },
    [defaultAgent, onUseTemplate],
  );

  // Group by category
  const categories = new Map<string, TaskTemplate[]>();
  for (const t of TASK_TEMPLATES) {
    const list = categories.get(t.category) ?? [];
    list.push(t);
    categories.set(t.category, list);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Templates list */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <p className="mb-4 text-xs text-muted-foreground">
          Quick-create a task from a pre-built template. One click and
          it&apos;s running.
        </p>

        {[...categories.entries()].map(([category, templates]) => (
          <div key={category} className="mb-5">
            <h3 className="mb-2 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {category}
            </h3>
            <div className="flex flex-col gap-2">
              {templates.map((template) => {
                const badge = TYPE_CONFIG[template.type];
                const BadgeIcon = badge.icon;
                const payload = template.build(defaultAgent);
                const scheduleLabel = humanReadableSchedule(payload.schedule);
                const isBusy = busyId === template.id;

                return (
                  <button
                    key={template.id}
                    type="button"
                    disabled={busyId !== null}
                    className="flex items-start gap-3 rounded-lg border border-border/80 bg-card/70 p-3 text-left transition hover:border-border hover:bg-muted/30 hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void handleUse(template)}
                  >
                    <span className="mt-0.5 text-lg">{template.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">
                          {template.name}
                        </span>
                        <span
                          className={`inline-flex items-center gap-0.5 rounded border px-1 py-0.5 font-sans text-[8px] font-semibold uppercase tracking-wider ${badge.className}`}
                        >
                          <BadgeIcon className="h-2 w-2" />
                          {template.type}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {template.description}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {scheduleLabel}
                      </p>
                    </div>
                    {isBusy ? (
                      <Loader2 className="mt-1 h-4 w-4 animate-spin text-primary/60" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
