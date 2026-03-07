"use client";

import React, { useCallback, useState } from "react";
import {
  Bot,
  Brain,
  ChevronDown,
  ChevronRight,
  Cpu,
  User,
  Wrench,
} from "lucide-react";
import { formatCostOrEmpty, formatTokensOrEmpty } from "@/lib/text/format";
import type { TraceTurn } from "../../lib/traceParser";

const ROLE_ICON: Record<string, React.ReactNode> = {
  user: <User className="h-3.5 w-3.5 text-blue-400" />,
  assistant: <Bot className="h-3.5 w-3.5 text-emerald-400" />,
  system: <Cpu className="h-3.5 w-3.5 text-amber-400" />,
};

const ROLE_LABEL: Record<string, string> = {
  user: "User",
  assistant: "Assistant",
  system: "System",
};

type ReplayTimelineProps = {
  turns: TraceTurn[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
};

type TurnRowProps = {
  turn: TraceTurn;
  index: number;
  isSelected: boolean;
  onSelect: (index: number) => void;
};

const TurnRow = React.memo(function TurnRow({
  turn,
  index,
  isSelected,
  onSelect,
}: TurnRowProps) {
  const [toolsExpanded, setToolsExpanded] = useState(false);
  const hasTools = turn.toolCalls.length > 0;
  const hasThinking = !!turn.thinkingContent;

  const handleClick = useCallback(() => {
    onSelect(index);
  }, [index, onSelect]);

  const handleToolsToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setToolsExpanded((v) => !v);
  }, []);

  const preview =
    turn.content.length > 100 ? turn.content.slice(0, 100) + "…" : turn.content || "(empty)";

  const durationText =
    turn.latencyMs != null
      ? turn.latencyMs < 1000
        ? `${turn.latencyMs}ms`
        : `${(turn.latencyMs / 1000).toFixed(1)}s`
      : null;

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        aria-selected={isSelected}
        role="option"
        className={`group flex w-full items-start gap-3 border-b border-border/40 px-3 py-2.5 text-left text-xs transition hover:bg-muted/40 min-h-[44px] ${
          isSelected ? "bg-accent" : ""
        }`}
      >
        {/* Step number */}
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums ${
            isSelected
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {index + 1}
        </span>

        {/* Role icon */}
        <span className="mt-0.5 shrink-0">
          {ROLE_ICON[turn.role] ?? ROLE_ICON.system}
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-medium capitalize text-foreground/70">
              {ROLE_LABEL[turn.role] ?? turn.role}
            </span>
            {hasThinking && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-purple-500/10 px-1.5 py-0 text-[10px] text-purple-400">
                <Brain className="h-2.5 w-2.5" />
                thinking
              </span>
            )}
            {hasTools && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-500/10 px-1.5 py-0 text-[10px] text-orange-400">
                <Wrench className="h-2.5 w-2.5" />
                {turn.toolCalls.length} tool{turn.toolCalls.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-foreground/60">{preview}</p>
        </div>

        {/* Right-side metrics */}
        <div className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
          {durationText && (
            <span className="font-sans text-[10px] text-muted-foreground">{durationText}</span>
          )}
          {turn.tokens.total > 0 && (
            <span className="font-sans text-[10px] text-muted-foreground">
              {formatTokensOrEmpty(turn.tokens.total)}
            </span>
          )}
          {turn.cost.total > 0 && (
            <span className="font-sans text-[10px] text-muted-foreground">
              {formatCostOrEmpty(turn.cost.total)}
            </span>
          )}
        </div>
      </button>

      {/* Tool call list — expandable inline */}
      {hasTools && (
        <div className={`border-b border-border/20 ${isSelected ? "bg-accent/40" : "bg-muted/10"}`}>
          <button
            type="button"
            onClick={handleToolsToggle}
            className="flex w-full items-center gap-2 px-10 py-1 text-left text-xs text-muted-foreground transition hover:text-foreground/70 min-h-[32px]"
          >
            {toolsExpanded ? (
              <ChevronDown className="h-3 w-3 shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 shrink-0" />
            )}
            <span>
              {turn.toolCalls.length} tool call{turn.toolCalls.length !== 1 ? "s" : ""}
            </span>
          </button>
          {toolsExpanded && (
            <ul className="px-10 pb-2 space-y-0.5">
              {turn.toolCalls.map((tc) => (
                <li
                  key={tc.id}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Wrench className="h-2.5 w-2.5 shrink-0 text-orange-400" />
                  <span className="font-mono truncate">{tc.name}</span>
                  {tc.durationMs !== undefined && (
                    <span className="ml-auto font-sans text-[10px]">
                      {tc.durationMs < 1000
                        ? `${tc.durationMs}ms`
                        : `${(tc.durationMs / 1000).toFixed(1)}s`}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
});

export const ReplayTimeline = React.memo(function ReplayTimeline({
  turns,
  selectedIndex,
  onSelect,
}: ReplayTimelineProps) {
  if (turns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-xs text-muted-foreground">
        No steps to replay
      </div>
    );
  }

  return (
    <div
      role="listbox"
      aria-label="Session replay timeline"
      className="h-full overflow-auto"
    >
      {turns.map((turn, i) => (
        <TurnRow
          key={`turn-${i}`}
          turn={turn}
          index={i}
          isSelected={selectedIndex === i}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
});
