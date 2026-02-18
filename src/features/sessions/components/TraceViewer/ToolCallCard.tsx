"use client";

import React, { useState } from "react";
import { ChevronRight, ChevronDown, Wrench } from "lucide-react";

import { MarkdownViewer } from "@/components/MarkdownViewer";
import type { ToolCallTrace } from "../../lib/traceParser";

type ToolCallCardProps = {
  toolCall: ToolCallTrace;
};

export const ToolCallCard = React.memo(function ToolCallCard({
  toolCall,
}: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  const argsJson = JSON.stringify(toolCall.arguments, null, 2);
  const hasResult = toolCall.result !== undefined;
  const resultPreview =
    toolCall.result && toolCall.result.length > 200
      ? toolCall.result.slice(0, 200) + "…"
      : toolCall.result;

  return (
    <div className="rounded-lg border border-border bg-card/50">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-muted/30"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <Wrench className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="font-semibold text-foreground">{toolCall.name}</span>
        {toolCall.durationMs !== undefined && (
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {toolCall.durationMs < 1000
              ? `${toolCall.durationMs}ms`
              : `${(toolCall.durationMs / 1000).toFixed(1)}s`}
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-border/40 px-3 py-2">
          <div>
            <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Arguments
            </div>
            <MarkdownViewer content={`\`\`\`json\n${argsJson}\n\`\`\``} />
          </div>
          {hasResult && (
            <div>
              <div className="mb-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Result
              </div>
              <div className="max-h-48 overflow-auto rounded-md bg-muted/30 p-2 text-xs text-foreground/80">
                <pre className="whitespace-pre-wrap break-all font-mono text-[11px]">
                  {resultPreview}
                </pre>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});
