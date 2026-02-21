"use client";

import { memo } from "react";
import { MarkdownViewer } from "@/components/MarkdownViewer";
import { ThinkingBlock } from "@/components/chat/ThinkingBlock";
import { ToolCallBlock } from "@/components/chat/ToolCallBlock";
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

/** Renders a list of MessageParts — text as markdown, thinking blocks, tool calls */
export const MessagePartsRenderer = memo(function MessagePartsRenderer({
  parts,
}: {
  parts: MessagePart[];
}) {
  return (
    <div className="space-y-2">
      {parts.map((part, i) => {
        if (isTextPart(part) && part.text.trim()) {
          return (
            <MarkdownViewer
              key={`text-${i}`}
              content={part.text}
              className="text-xs text-foreground/90"
            />
          );
        }
        if (isReasoningPart(part)) {
          return (
            <ThinkingBlock
              key={`think-${i}`}
              text={part.text}
              streaming={part.streaming}
              startedAt={part.startedAt}
              completedAt={part.completedAt}
            />
          );
        }
        if (isToolInvocationPart(part)) {
          return (
            <ToolCallBlock
              key={`tool-${part.toolCallId}`}
              name={part.name}
              phase={part.phase}
              args={part.args}
              result={part.result}
              startedAt={part.startedAt}
              completedAt={part.completedAt}
            />
          );
        }
        return null;
      })}
    </div>
  );
});
