"use client";

import React, { useState } from "react";
import { Wrench, ChevronRight, Clock, CheckCircle2, Loader2, AlertCircle, type LucideIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { ErrorBanner } from "@/components/ErrorBanner";
import { formatElapsedLabel } from "@/lib/text/time";

export type ToolCallPhase = "pending" | "running" | "complete" | "error";

export type ToolCallBlockProps = {
  /** Tool name (e.g. "web_search", "exec") */
  name: string;
  /** Current execution phase */
  phase: ToolCallPhase;
  /** Serialized arguments (JSON string) */
  args?: string;
  /** Tool result text */
  result?: string;
  /** Timestamp (ms) when tool call started */
  startedAt?: number;
  /** Timestamp (ms) when tool call completed */
  completedAt?: number;
  className?: string;
};

const phaseConfig: Record<
  ToolCallPhase,
  { label: string; Icon: LucideIcon; iconClass: string }
> = {
  pending: {
    label: "Pending",
    Icon: Clock,
    iconClass: "text-muted-foreground/60",
  },
  running: {
    label: "Running…",
    Icon: Loader2,
    iconClass: "text-brand-gold animate-spin",
  },
  complete: {
    label: "Complete",
    Icon: CheckCircle2,
    iconClass: "text-emerald-500/70",
  },
  error: {
    label: "Error",
    Icon: AlertCircle,
    iconClass: "text-destructive",
  },
};

/**
 * Compact tool call display block.
 *
 * Collapsed: inline one-liner "🔧 exec — Complete • 2.3s" — no border, minimal chrome.
 * Expanded: args + result in a subtle container.
 * Auto-opens while running.
 */
export const ToolCallBlock = React.memo(function ToolCallBlock({
  name,
  phase,
  args,
  result,
  startedAt,
  completedAt,
  className = "",
}: ToolCallBlockProps) {
  const [open, setOpen] = useState(false);

  // Defensive: if a tool call has been "running" for > 10s without an update,
  // treat it as complete. This prevents permanently stuck spinners when
  // completion events are lost (e.g. gateway restart, filter bugs).
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const effectivePhase = React.useMemo(() => {
    if (phase !== "running" || !startedAt) return phase;
    const elapsed = nowMs - startedAt;
    if (elapsed > 10_000) return "complete";
    return phase;
  }, [phase, startedAt, nowMs]);

  // Re-render after timeout so spinner disappears for stale tool calls
  React.useEffect(() => {
    if (phase !== "running" || !startedAt) return;
    const elapsed = Date.now() - startedAt;
    const remaining = 10_000 - elapsed;
    if (remaining <= 0) {
      setNowMs(Date.now());
      return;
    }
    const timer = setTimeout(() => setNowMs(Date.now()), remaining + 100);
    return () => clearTimeout(timer);
  }, [phase, startedAt]);

  const config = phaseConfig[effectivePhase];
  const { Icon } = config;

  const durationLabel = formatElapsedLabel(startedAt, completedAt, effectivePhase === "running" || effectivePhase === "pending" ? true : undefined);
  const hasContent = !!(args || result);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={className}>
      <CollapsibleTrigger
        aria-label={`Tool call: ${name} — ${config.label}${durationLabel ? ` (${durationLabel})` : ""}`}
        className="group/tool flex items-center gap-1.5 rounded-md px-3 py-3 min-h-[44px] sm:px-2 sm:py-1.5 sm:min-h-[36px] text-left transition-colors hover:bg-muted/50"
      >
        {/* Chevron — only if expandable */}
        {hasContent ? (
          <ChevronRight
            size={14}
            strokeWidth={1.75}
            className={`shrink-0 text-muted-foreground/50 transition-transform ${
              open ? "rotate-90" : ""
            }`}
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Tool icon */}
        <Wrench size={14} strokeWidth={1.75} className="shrink-0 text-muted-foreground/60" />

        {/* Tool name */}
        <span className="text-xs font-medium text-foreground/80">{friendlyToolName(name)}</span>

        {/* Phase indicator */}
        <span className="flex items-center gap-1 text-xs">
          <Icon size={14} strokeWidth={1.75} className={config.iconClass} />
          <span className="text-muted-foreground/60">{config.label}</span>
        </span>

        {/* Duration */}
        {durationLabel ? (
          <span className="font-sans text-xs tabular-nums text-muted-foreground/50">
            {durationLabel}
          </span>
        ) : null}
      </CollapsibleTrigger>

      {hasContent && (
        <CollapsibleContent>
          <div className="ml-5 mt-1 space-y-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2">
            {/* Arguments */}
            {args && (
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/50">
                  Args
                </span>
                <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap break-all text-xs text-muted-foreground/80">
                  {formatArgs(args)}
                </pre>
              </div>
            )}

            {/* Result */}
            {result && phase === "error" ? (
              <ErrorBanner message={result} />
            ) : result ? (
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground/50">
                  Result
                </span>
                <MarkdownViewer
                  content={result}
                  className="mt-0.5 text-xs text-muted-foreground opacity-80"
                />
              </div>
            ) : null}
          </div>
        </CollapsibleContent>
      )}
    </Collapsible>
  );
});

/* ── Helpers ── */

/** Human-friendly labels for common tool names (shown to non-technical users). */
const TOOL_DISPLAY_NAMES: Record<string, string> = {
  exec: "Run Command",
  read: "Read File",
  Read: "Read File",
  write: "Write File",
  Write: "Write File",
  edit: "Edit File",
  Edit: "Edit File",
  web_search: "Search Web",
  web_fetch: "Fetch Page",
  browser: "Browser",
  image: "Analyze Image",
  memory_search: "Search Memory",
  memory_get: "Read Memory",
  message: "Send Message",
  tts: "Text to Speech",
  process: "Manage Process",
  canvas: "Canvas",
  nodes: "Device Control",
  sessions_spawn: "Launch Agent",
  sessions_send: "Message Agent",
  subagents: "Manage Agents",
  session_status: "Session Status",
};

export function friendlyToolName(name: string): string {
  return TOOL_DISPLAY_NAMES[name] ?? name;
}

function formatArgs(args: string): string {
  try {
    return JSON.stringify(JSON.parse(args), null, 2);
  } catch {
    return args;
  }
}
