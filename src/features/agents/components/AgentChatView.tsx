"use client";

import { memo } from "react";
import { useShallowArrayMemo } from "@/lib/hooks/useShallowMemo";
import type { MessagePart } from "@/lib/chat/types";
import {
  isTextPart,
  isReasoningPart,
  isToolInvocationPart,
  isImagePart,
  isStatusPart,
} from "@/lib/chat/types";
import { InlineChatImage } from "./ChatImageViewer";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { ThinkingBlock } from "@/components/chat/ThinkingBlock";
import { ToolCallBlock } from "@/components/chat/ToolCallBlock";
import { ChatStatusBar } from "@/components/chat/ChatStatusBar";
// TokenCostDisplay will be used in Phase 3 when wiring token data per turn
// import { TokenCostDisplay } from "@/components/chat/TokenCostDisplay";
import { MessageActions } from "./MessageActions";

// ── Types ──────────────────────────────────────────────────────────────

export type AgentChatViewProps = {
  /** Structured message parts from the gateway event handler */
  parts: MessagePart[];
  /** Whether the agent is currently streaming */
  streaming: boolean;
  className?: string;
};

// ── Message grouping ───────────────────────────────────────────────────

/**
 * Group consecutive assistant parts (text, reasoning, tool-invocation) into
 * "turns" separated by user text parts. This allows rendering turn separators
 * and grouping token displays per assistant response.
 */
type MessageGroup = {
  kind: "user" | "assistant" | "status";
  parts: MessagePart[];
};

function groupParts(parts: MessagePart[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let current: MessageGroup | null = null;

  for (const part of parts) {
    if (isStatusPart(part)) {
      // Status parts are standalone
      if (current) groups.push(current);
      groups.push({ kind: "status", parts: [part] });
      current = null;
      continue;
    }

    // Detect "user" text parts by checking if the text starts with ">"
    // (gateway convention for user messages in outputLines, also used in messageParts)
    const isUser = isTextPart(part) && part.text.trimStart().startsWith(">");
    const kind = isUser ? "user" : "assistant";

    if (!current || current.kind !== kind) {
      if (current) groups.push(current);
      current = { kind, parts: [part] };
    } else {
      current.parts.push(part);
    }
  }

  if (current) groups.push(current);
  return groups;
}

// ── Renderers ──────────────────────────────────────────────────────────

const UserMessage = memo(function UserMessage({ text }: { text: string }) {
  // Strip leading ">" prefix from user messages
  const cleaned = text.replace(/^>\s*/, "").trim();
  return (
    <MessageBubble
      role="user"
      content={cleaned}
      actions={<MessageActions text={cleaned} />}
    />
  );
});

const AssistantText = memo(function AssistantText({
  text,
  streaming,
}: {
  text: string;
  streaming: boolean;
}) {
  return (
    <MessageBubble
      role="assistant"
      content={text}
      streaming={streaming}
      actions={<MessageActions text={text} />}
    />
  );
});

function renderPart(part: MessagePart, index: number) {
  if (isTextPart(part)) {
    return (
      <AssistantText
        key={`text-${index}`}
        text={part.text}
        streaming={part.streaming ?? false}
      />
    );
  }

  if (isReasoningPart(part)) {
    return (
      <ThinkingBlock
        key={`reasoning-${index}`}
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
        key={`tool-${part.toolCallId}-${index}`}
        name={part.name}
        phase={part.phase}
        args={part.args}
        result={part.result}
        startedAt={part.startedAt}
        completedAt={part.completedAt}
      />
    );
  }

  if (isImagePart(part)) {
    return (
      <InlineChatImage
        key={`image-${index}`}
        src={part.src}
        alt={part.alt}
      />
    );
  }

  if (isStatusPart(part)) {
    return (
      <ChatStatusBar
        key={`status-${index}`}
        state={part.state}
        model={part.model}
        runStartedAt={part.runStartedAt}
      />
    );
  }

  return null;
}

// ── Main Component ─────────────────────────────────────────────────────

/**
 * Renders structured `MessagePart[]` using AI Elements components.
 *
 * Replaces the old string-based rendering pipeline (chatItems.ts + inline JSX)
 * with typed components: ThinkingBlock, ToolCallBlock, ChatStatusBar,
 * TokenCostDisplay, and MarkdownViewer for text.
 */
export const AgentChatView = memo(function AgentChatView({
  parts,
  streaming: _streaming,
  className = "",
}: AgentChatViewProps) {
  // streaming will be used in Phase 3 for live streaming indicators
  void _streaming;
  const groups = useShallowArrayMemo(() => groupParts(parts), parts);

  if (parts.length === 0) {
    return null;
  }

  return (
    <div className={`flex w-full min-w-0 flex-col gap-3 ${className}`}>
      {groups.map((group, gi) => {
        if (group.kind === "user") {
          // User messages — render each text part
          return group.parts.map((part, pi) => (
            <div key={`user-${gi}-${pi}`} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <UserMessage
                text={isTextPart(part) ? part.text : ""}
              />
            </div>
          ));
        }

        if (group.kind === "status") {
          return group.parts.map((p, pi) => renderPart(p, gi * 1000 + pi));
        }

        // Assistant group — render all parts + optional turn separator
        return (
          <div key={`assistant-${gi}`} className="flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Turn separator if previous group was user */}
            {gi > 0 && groups[gi - 1]?.kind === "user" && (
              <div className="my-1 border-t border-border/30" role="separator" />
            )}
            {group.parts.map((part, pi) =>
              renderPart(part, gi * 1000 + pi)
            )}
          </div>
        );
      })}
    </div>
  );
});
