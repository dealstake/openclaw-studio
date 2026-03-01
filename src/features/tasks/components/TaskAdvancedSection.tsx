"use client";

import { memo } from "react";
import { Megaphone } from "lucide-react";
import type { StudioTask } from "@/features/tasks/types";
import {
  THINKING_OPTIONS,
  CACHE_RETENTION_OPTIONS,
  DELIVERY_MODE_OPTIONS,
} from "@/features/tasks/types";
import { sectionLabelClass } from "@/components/SectionLabel";
import { formatModelDisplayName } from "@/lib/models/utils";
import { inputClass } from "@/features/tasks/lib/styles";

// ─── Props ───────────────────────────────────────────────────────────────────

interface TaskAdvancedSectionProps {
  task: StudioTask;
  editing: boolean;
  editModel: string;
  editThinking: string;
  editCacheRetention: string;
  editDeliveryChannel: string;
  editDeliveryTarget: string;
  onFieldChange: (
    field: "model" | "thinking" | "cacheRetention" | "deliveryChannel" | "deliveryTarget",
    value: string
  ) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TaskAdvancedSection = memo(function TaskAdvancedSection({
  task,
  editing,
  editModel,
  editThinking,
  editCacheRetention,
  editDeliveryChannel,
  editDeliveryTarget,
  onFieldChange,
}: TaskAdvancedSectionProps) {
  return (
    <>
      {/* Model, Thinking, Agent, Runs */}
      <div className="border-b border-border/40 px-4 py-3">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
          {editing ? (
            <div className="flex items-center gap-1.5">
              <span>Model:</span>
              <input
                className={`${inputClass} w-48`}
                value={editModel}
                onChange={(e) => onFieldChange("model", e.target.value)}
                placeholder="e.g. anthropic/claude-sonnet-4-6"
              />
            </div>
          ) : (
            <span>Model: {formatModelDisplayName(task.model)}</span>
          )}
          {editing ? (
            <div className="flex items-center gap-1.5">
              <span>Thinking:</span>
              <select
                aria-label="Thinking level"
                className="h-6 rounded-md border border-border/80 bg-card/70 px-1.5 font-mono text-[11px] text-foreground outline-none transition hover:border-border focus:border-primary/60"
                value={editThinking}
                onChange={(e) => onFieldChange("thinking", e.target.value)}
              >
                {THINKING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : task.thinking ? (
            <span>Thinking: {task.thinking}</span>
          ) : null}
          {editing ? (
            <div className="flex items-center gap-1.5">
              <span>Cache:</span>
              <select
                aria-label="Cache retention"
                className="h-6 rounded-md border border-border/80 bg-card/70 px-1.5 font-mono text-[11px] text-foreground outline-none transition hover:border-border focus:border-primary/60"
                value={editCacheRetention}
                onChange={(e) => onFieldChange("cacheRetention", e.target.value)}
              >
                {CACHE_RETENTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ) : task.cacheRetention ? (
            <span>Cache: {task.cacheRetention}</span>
          ) : null}
          <span>Agent: {task.agentId}</span>
          <span>Runs: {task.runCount}</span>
          {task.consecutiveErrors ? (
            <span className="font-semibold text-destructive">
              {task.consecutiveErrors} consecutive error
              {task.consecutiveErrors > 1 ? "s" : ""}
            </span>
          ) : null}
        </div>
      </div>

      {/* Delivery */}
      {editing || task.deliveryChannel ? (
        <div className="border-b border-border/40 px-4 py-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Megaphone className="h-3 w-3 shrink-0" />
            <span className={sectionLabelClass}>Delivery</span>
          </div>
          {editing ? (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Mode:</span>
                <select
                  aria-label="Delivery mode"
                  className="h-6 rounded-md border border-border/80 bg-card/70 px-1.5 font-mono text-[11px] text-foreground outline-none transition hover:border-border focus:border-primary/60"
                  value={editDeliveryChannel ? "announce" : "none"}
                  onChange={(e) => {
                    if (e.target.value === "none") {
                      onFieldChange("deliveryChannel", "");
                      onFieldChange("deliveryTarget", "");
                    }
                  }}
                >
                  {DELIVERY_MODE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Channel:</span>
                <input
                  className={`${inputClass} w-32`}
                  value={editDeliveryChannel}
                  onChange={(e) => onFieldChange("deliveryChannel", e.target.value)}
                  placeholder="e.g. whatsapp"
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">Target:</span>
                <input
                  className={`${inputClass} w-40`}
                  value={editDeliveryTarget}
                  onChange={(e) => onFieldChange("deliveryTarget", e.target.value)}
                  placeholder="e.g. user id"
                />
              </div>
            </div>
          ) : (
            <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
              <span>Channel: {task.deliveryChannel || "default"}</span>
              {task.deliveryTarget ? <span>Target: {task.deliveryTarget}</span> : null}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
});
