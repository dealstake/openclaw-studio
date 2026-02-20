"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Loader2, AlertCircle } from "lucide-react";
import type { MessagePart, ToolInvocationPart } from "@/lib/chat/types";
import {
  isTextPart,
  isReasoningPart,
  isToolInvocationPart,
  isStatusPart,
} from "@/lib/chat/types";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { ThinkingBlock } from "@/components/chat/ThinkingBlock";
import { ToolCallBlock } from "@/components/chat/ToolCallBlock";
import { ChatStatusBar } from "@/components/chat/ChatStatusBar";
import { transformMessagesToMessageParts } from "@/features/sessions/lib/transformMessages";
import { filterHeartbeatTurns } from "@/features/activity/lib/heartbeatFilter";
import { fetchTranscriptMessages } from "@/features/sessions/hooks/useTranscripts";

// ── Types ──────────────────────────────────────────────────────────────

export interface ExpandedTranscriptViewProps {
  /** Pre-loaded parts (from enriched JSONL transcript_json) */
  parts?: MessagePart[];
  /** Or load on-demand from session */
  agentId?: string;
  sessionId?: string;
  className?: string;
}

// ── Lazy Tool Call ─────────────────────────────────────────────────────

const LazyToolCallBlock = React.memo(function LazyToolCallBlock({
  part,
}: {
  part: ToolInvocationPart;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex w-full items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <span className="font-mono text-[11px]">{part.name}</span>
        <span className="text-muted-foreground/50">•</span>
        <span className="text-[11px]">
          {part.phase === "complete" ? "completed" : part.phase}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground/40">click to expand</span>
      </button>
    );
  }

  return (
    <ToolCallBlock
      name={part.name}
      phase={part.phase}
      args={part.args}
      result={part.result}
      startedAt={part.startedAt}
      completedAt={part.completedAt}
    />
  );
});

// ── Part Renderer ──────────────────────────────────────────────────────

const PartRenderer = React.memo(function PartRenderer({
  part,
}: {
  part: MessagePart;
}) {
  if (isTextPart(part)) {
    const isUser = part.text.trimStart().startsWith(">");
    if (isUser) {
      const cleaned = part.text.replace(/^>\s*/, "").trim();
      return (
        <div className="rounded-md border border-border/70 bg-muted/70 px-3 py-2">
          <MarkdownViewer content={cleaned} />
        </div>
      );
    }
    return (
      <div className="px-1">
        <MarkdownViewer content={part.text} />
      </div>
    );
  }

  if (isReasoningPart(part)) {
    return (
      <ThinkingBlock
        text={part.text}
        streaming={part.streaming}
        startedAt={part.startedAt}
        completedAt={part.completedAt}
      />
    );
  }

  if (isToolInvocationPart(part)) {
    return <LazyToolCallBlock part={part} />;
  }

  if (isStatusPart(part)) {
    return (
      <ChatStatusBar
        state={part.state}
        model={part.model}
        runStartedAt={part.runStartedAt}
      />
    );
  }

  return null;
});

// ── Main Component ─────────────────────────────────────────────────────

export const ExpandedTranscriptView = React.memo(function ExpandedTranscriptView({
  parts: preloadedParts,
  agentId,
  sessionId,
  className,
}: ExpandedTranscriptViewProps) {
  const [parts, setParts] = useState<MessagePart[]>(preloadedParts ?? []);
  const [loading, setLoading] = useState(!preloadedParts);
  const [error, setError] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  // Load transcript on-demand if not pre-loaded
  useEffect(() => {
    if (preloadedParts || !agentId || !sessionId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchTranscriptMessages(agentId, sessionId)
      .then((resp) => {
        if (cancelled) return;
        const transformed = transformMessagesToMessageParts(resp.messages);
        setParts(filterHeartbeatTurns(transformed));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load transcript");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [preloadedParts, agentId, sessionId]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Virtual
  const virtualizer = useVirtualizer({
    count: parts.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 80, []),
    overscan: 5,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Loading transcript…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-destructive">
        <AlertCircle className="h-4 w-4" />
        <span className="text-xs">{error}</span>
      </div>
    );
  }

  if (parts.length === 0) {
    return (
      <div className="py-8 text-center text-xs text-muted-foreground">
        No transcript available
      </div>
    );
  }

  return (
    <div ref={parentRef} className={`overflow-y-auto ${className ?? ""}`} style={{ height: "100%" }}>
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => (
          <div
            key={virtualItem.key}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            <div className="px-2 py-1">
              <PartRenderer part={parts[virtualItem.index]} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
