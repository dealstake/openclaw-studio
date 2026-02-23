"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Brain, Loader2, MessageSquare } from "lucide-react";
import type { MessagePart } from "@/lib/chat/types";

// ── High-level agent phase (not per-tool) ──────────────────────────────

type AgentPhase = "thinking" | "streaming" | "working";

function detectPhase(parts: MessagePart[]): AgentPhase {
  // Walk backwards — most recent streaming part determines phase
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part.type === "text" && part.streaming) return "streaming";
    if (part.type === "reasoning" && part.streaming) return "thinking";
  }
  // Default: agent is working (thinking, using tools, processing — all opaque)
  return "working";
}

const PHASE_CONFIG: Record<AgentPhase, { icon: typeof Brain; label: string }> = {
  thinking: { icon: Brain, label: "Thinking" },
  streaming: { icon: MessageSquare, label: "Streaming" },
  working: { icon: Loader2, label: "Working" },
};

// ── Elapsed timer (direct DOM mutation, no re-renders per tick) ────────

const ElapsedBadge = memo(function ElapsedBadge({
  startMs,
}: {
  startMs: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    function tick() {
      if (!ref.current) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      ref.current.textContent =
        mins > 0
          ? `${mins}m ${String(secs).padStart(2, "0")}s`
          : `${secs}s`;
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [startMs]);

  return <span ref={ref} className="tabular-nums">0s</span>;
});

// ── Main component ─────────────────────────────────────────────────────

export type StreamingStatusProps = {
  /** Whether the agent run is active */
  running: boolean;
  /** Live messageParts to derive the current phase */
  messageParts: MessagePart[];
  /** Timestamp (ms) when the run started — drives elapsed timer */
  runStartedAt?: number | null;
};

/**
 * Compact agent status indicator — shows phase + elapsed timer.
 * Grouped with the token gauge in the composer toolbar.
 * Phases: Working (default) → Thinking (reasoning) → Streaming (text output)
 */
export const StreamingStatus = memo(function StreamingStatus({
  running,
  messageParts,
  runStartedAt,
}: StreamingStatusProps) {
  // Track when this run started (fallback to first "running" render)
  const [fallbackStart] = useState(() => Date.now());
  const effectiveStart = runStartedAt ?? fallbackStart;

  if (!running) return null;

  const phase = detectPhase(messageParts);
  const { icon: Icon, label } = PHASE_CONFIG[phase];
  const isSpinner = phase === "working";

  return (
    <div
      className="flex items-center gap-1.5 text-[11px] text-muted-foreground/90 animate-in fade-in slide-in-from-right-2 duration-200"
      role="status"
      aria-live="polite"
      aria-label={`Agent is ${label.toLowerCase()}`}
    >
      <Icon
        size={12}
        strokeWidth={1.75}
        className={
          isSpinner
            ? "shrink-0 animate-spin text-muted-foreground"
            : "shrink-0 animate-pulse text-brand-gold"
        }
      />
      <span className="hidden sm:inline">{label}</span>
      <span className="text-muted-foreground/40">·</span>
      <span className="font-mono text-[10px] text-muted-foreground/70">
        <ElapsedBadge startMs={effectiveStart} />
      </span>
    </div>
  );
});
