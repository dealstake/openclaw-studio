"use client";

import React from "react";
import { Brain, Wrench, MessageSquare, Loader2, AlertTriangle } from "lucide-react";
import { SectionLabel } from "@/components/SectionLabel";

export type ChatStatusBarProps = {
  /** Agent state: "idle" | "thinking" | "tool" | "streaming" | "error" or custom string */
  state: string;
  /** Model name to display (e.g. "claude-opus-4-6") */
  model?: string;
  /** Timestamp (ms) when the current run started — drives elapsed timer */
  runStartedAt?: number;
  /** Error or abort message (shown when state is "error") */
  errorMessage?: string;
  className?: string;
};

/* ── state → icon + label mapping ── */
const STATE_CONFIG: Record<string, { icon: React.ElementType; label: string }> = {
  idle: { icon: MessageSquare, label: "Idle" },
  thinking: { icon: Brain, label: "Thinking…" },
  tool: { icon: Wrench, label: "Using tool…" },
  streaming: { icon: MessageSquare, label: "Streaming…" },
  error: { icon: AlertTriangle, label: "Error" },
};

/**
 * Persistent status bar showing agent state, elapsed timer, and model name.
 *
 * Timer uses a CSS counter-based animation to avoid React re-renders per second.
 * The `--start` custom property seeds the keyframe offset.
 */
export const ChatStatusBar = React.memo(function ChatStatusBar({
  state,
  model,
  runStartedAt,
  errorMessage,
  className = "",
}: ChatStatusBarProps) {
  const { icon: Icon, label } =
    STATE_CONFIG[state] ?? { icon: Loader2, label: state };

  const isActive = state !== "idle" && state !== "error";
  const isError = state === "error";

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${
        isError
          ? "border-destructive/40 bg-destructive/5"
          : "border-border bg-card/80"
      } ${className}`}
    >
      {/* State icon */}
      <Icon
        size={14}
        strokeWidth={1.75}
        className={`shrink-0 ${
          isError
            ? "text-destructive"
            : isActive
              ? "text-brand-gold animate-pulse"
              : "text-muted-foreground"
        }`}
      />

      {/* State label or error message */}
      {isError && errorMessage ? (
        <span className="text-xs text-destructive/90">{errorMessage}</span>
      ) : (
        <SectionLabel as="span" className={isActive ? "text-foreground" : ""}>
          {label}
        </SectionLabel>
      )}

      {/* Elapsed timer — only while active */}
      {isActive && runStartedAt ? (
        <ElapsedTimer runStartedAt={runStartedAt} />
      ) : null}

      {/* Model name — right-aligned */}
      {model ? (
        <span
          className={`${isActive && runStartedAt ? "" : "ml-auto"} truncate font-sans text-[10px] text-muted-foreground/70`}
          title={model}
        >
          {model}
        </span>
      ) : null}
    </div>
  );
});

/* ── ElapsedTimer ── */

/**
 * Lightweight elapsed timer that updates via setInterval + direct DOM mutation
 * (no React re-renders per tick).
 */
const ElapsedTimer = React.memo(function ElapsedTimer({
  runStartedAt,
}: {
  runStartedAt: number;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (!ref.current) return;

    function tick() {
      if (!ref.current) return;
      const elapsed = Math.max(0, Math.floor((Date.now() - runStartedAt) / 1000));
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      ref.current.textContent = mins > 0
        ? `${mins}m ${String(secs).padStart(2, "0")}s`
        : `${secs}s`;
    }

    tick(); // immediate first render
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [runStartedAt]);

  return (
    <span
      className="ml-auto font-sans text-[10px] tabular-nums text-muted-foreground"
      title={`Started at ${new Date(runStartedAt).toLocaleTimeString()}`}
    >
      <span ref={ref}>0s</span>
    </span>
  );
});
