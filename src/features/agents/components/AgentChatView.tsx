"use client";

import { memo, useDeferredValue } from "react";
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
import { ToolCallGroup } from "@/components/chat/ToolCallGroup";
import { ChatStatusBar } from "@/components/chat/ChatStatusBar";
import { MessageActions } from "./MessageActions";
import { FeedbackToolbar } from "@/features/feedback/components/FeedbackToolbar";
import { Bot } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────

export type AgentChatViewProps = {
  /** Structured message parts from the gateway event handler */
  parts: MessagePart[];
  /** Whether the agent is currently streaming */
  streaming: boolean;
  /**
   * Session key for annotation scoping.
   * When provided, FeedbackToolbar is rendered on each assistant message group.
   * Omit for read-only transcript views (e.g., session history viewer).
   */
  sessionKey?: string;
  /** Agent display name — shown at assistant turn boundaries */
  agentName?: string;
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

/**
 * Returns true if any text or reasoning part in the group is currently streaming.
 * Used to suppress FeedbackToolbar on in-progress assistant turns.
 */
function isGroupStreaming(parts: MessagePart[]): boolean {
  return parts.some(
    (p) =>
      (isTextPart(p) || isReasoningPart(p)) && p.streaming === true,
  );
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
    // Status is now shown via the circular progress ring on the composer button.
    // Only render error states inline — everything else is handled by the button.
    if (part.state === "error" && part.errorMessage) {
      return (
        <ChatStatusBar
          key={`status-${index}`}
          state={part.state}
          errorMessage={part.errorMessage}
        />
      );
    }
    return null;
  }

  return null;
}

// ── Grouped rendering ──────────────────────────────────────────────────

/**
 * Renders assistant parts, batching consecutive tool invocation parts into
 * a single ToolCallGroup. Text, reasoning, images, and status parts render
 * individually; consecutive tool calls collapse into "N tools • Complete • 3.2s".
 */
function renderGroupedParts(parts: MessagePart[], groupIndex: number) {
  const elements: React.ReactNode[] = [];
  let toolBatch: { part: MessagePart; index: number }[] = [];

  const flushToolBatch = () => {
    if (toolBatch.length === 0) return;
    const tools = toolBatch.map(({ part, index }) => {
      const tp = part as Extract<MessagePart, { type: "tool-invocation" }>;
      return {
        key: `tool-${tp.toolCallId}-${index}`,
        name: tp.name,
        phase: tp.phase,
        args: tp.args,
        result: tp.result,
        startedAt: tp.startedAt,
        completedAt: tp.completedAt,
      };
    });
    elements.push(
      <ToolCallGroup
        key={`toolgroup-${groupIndex}-${toolBatch[0].index}`}
        tools={tools}
      />
    );
    toolBatch = [];
  };

  for (let pi = 0; pi < parts.length; pi++) {
    const part = parts[pi];
    if (isToolInvocationPart(part)) {
      toolBatch.push({ part, index: pi });
    } else {
      flushToolBatch();
      elements.push(renderPart(part, groupIndex * 1000 + pi));
    }
  }
  flushToolBatch();

  return elements;
}

// ── Main Component ─────────────────────────────────────────────────────

/**
 * Renders structured `MessagePart[]` using AI Elements components.
 *
 * Replaces the old string-based rendering pipeline (chatItems.ts + inline JSX)
 * with typed components: ThinkingBlock, ToolCallBlock, ChatStatusBar,
 * and MarkdownViewer for text.
 */
export const AgentChatView = memo(function AgentChatView({
  parts,
  streaming,
  sessionKey,
  agentName,
  className = "",
}: AgentChatViewProps) {
  // Part-level streaming flags drive live rendering; top-level flag reserved
  // for future global indicators (e.g. pulsing cursor at end of stream).
  void streaming;

  // Defer grouping so high-frequency streaming updates don't block the
  // composer or other interactive UI. React renders the deferred value
  // in a lower-priority pass, keeping the page responsive during long streams.
  const deferredParts = useDeferredValue(parts);
  const groups = useShallowArrayMemo(() => groupParts(deferredParts), deferredParts);

  if (deferredParts.length === 0) {
    return null;
  }

  return (
    <div className={`flex w-full min-w-0 flex-col gap-5 leading-relaxed ${className}`}>
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

        // Assistant group — render parts, grouping consecutive tool calls
        const groupStreaming = isGroupStreaming(group.parts);
        return (
          <div key={`assistant-${gi}`} className="group/turn flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Turn separator + agent identity */}
            {(() => {
              const isFirstAssistant = gi === 0;
              const isFollowingUser = gi > 0 && groups[gi - 1]?.kind === "user";
              if (!isFirstAssistant && !isFollowingUser) return null;
              return (
                <>
                  {isFollowingUser && <div className="my-1 border-t border-border/30" role="separator" />}
                  {agentName && (
                    <div className="flex items-center gap-1.5 px-4">
                      <Bot className="h-3.5 w-3.5 text-muted-foreground/60" />
                      <span className="text-xs font-medium text-muted-foreground/70">{agentName}</span>
                    </div>
                  )}
                </>
              );
            })()}
            {renderGroupedParts(group.parts, gi)}
            {/* Inline feedback — hidden until hover (or when annotated) */}
            {sessionKey && !groupStreaming && (
              <FeedbackToolbar
                sessionKey={sessionKey}
                messageId={`g${gi}`}
                className="opacity-0 transition-opacity group-hover/turn:opacity-100 data-[annotated]:opacity-100"
              />
            )}
          </div>
        );
      })}
    </div>
  );
});
