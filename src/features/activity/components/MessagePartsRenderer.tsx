"use client";

import { memo } from "react";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { ThinkingBlock } from "@/components/chat/ThinkingBlock";
import { ToolCallGroup } from "@/components/chat/ToolCallGroup";
import type { MessagePart } from "@/lib/chat/types";
import {
  isTextPart,
  isReasoningPart,
  isToolInvocationPart,
} from "@/lib/chat/types";

/** Extract concatenated text from message parts */
export function getTextContent(parts: MessagePart[]): string {
  return parts
    .filter(isTextPart)
    .map((p) => p.text)
    .join("\n");
}

/** Renders a list of MessageParts — text as markdown, thinking blocks, tool calls (grouped) */
export const MessagePartsRenderer = memo(function MessagePartsRenderer({
  parts,
}: {
  parts: MessagePart[];
}) {
  // Group consecutive tool invocations into batches
  const elements: React.ReactNode[] = [];
  let toolBatch: { part: Extract<MessagePart, { type: "tool-invocation" }>; index: number }[] = [];

  const flushTools = () => {
    if (toolBatch.length === 0) return;
    const tools = toolBatch.map(({ part, index }) => ({
      key: `tool-${part.toolCallId}-${index}`,
      name: part.name,
      phase: part.phase,
      args: part.args,
      result: part.result,
      startedAt: part.startedAt,
      completedAt: part.completedAt,
    }));
    elements.push(
      <div
        key={`toolgroup-${toolBatch[0].index}`}
        className="border-l-2 border-muted-foreground/20 pl-2 ml-0.5"
      >
        <ToolCallGroup tools={tools} />
      </div>
    );
    toolBatch = [];
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (isToolInvocationPart(part)) {
      toolBatch.push({ part, index: i });
      continue;
    }
    flushTools();
    if (isTextPart(part) && part.text.trim()) {
      elements.push(
        <MarkdownViewer
          key={`text-${i}`}
          content={part.text}
          className="text-xs text-foreground/90"
        />
      );
    } else if (isReasoningPart(part)) {
      elements.push(
        <div
          key={`think-${i}`}
          className="rounded-md bg-muted/30 border border-border/20"
        >
          <ThinkingBlock
            text={part.text}
            streaming={part.streaming}
            startedAt={part.startedAt}
            completedAt={part.completedAt}
          />
        </div>
      );
    }
  }
  flushTools();

  return <div className="space-y-3">{elements}</div>;
});
