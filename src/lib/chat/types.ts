/**
 * Structured message part types for the chat rendering pipeline.
 *
 * Gateway WebSocket events → parseMessageParts → MessagePart[] → UI components
 *
 * Consumed by:
 * - Main Chat Rebuild (AgentChatPanel replacement)
 * - Unified Wizard Infrastructure (WizardChat)
 * - ChatStatusBar, ThinkingBlock, ToolCallBlock, TokenCostDisplay
 */

// ── Message Parts ──────────────────────────────────────────────────────

export type TextPart = {
  type: "text";
  text: string;
  streaming?: boolean;
};

export type ReasoningPart = {
  type: "reasoning";
  text: string;
  startedAt?: number;
  completedAt?: number;
  streaming?: boolean;
};

export type ToolInvocationPhase = "pending" | "running" | "complete" | "error";

export type ToolInvocationPart = {
  type: "tool-invocation";
  toolCallId: string;
  name: string;
  phase: ToolInvocationPhase;
  args?: string;
  result?: string;
  startedAt?: number;
  completedAt?: number;
};

export type ImagePart = {
  type: "image";
  src: string;
  alt?: string;
};

export type StatusPart = {
  type: "status";
  state: string;
  model?: string;
  runStartedAt?: number;
  errorMessage?: string;
};

export type MessagePart =
  | TextPart
  | ReasoningPart
  | ToolInvocationPart
  | ImagePart
  | StatusPart;

// ── Type Guards ────────────────────────────────────────────────────────

export function isTextPart(part: MessagePart): part is TextPart {
  return part.type === "text";
}

export function isReasoningPart(part: MessagePart): part is ReasoningPart {
  return part.type === "reasoning";
}

export function isToolInvocationPart(
  part: MessagePart,
): part is ToolInvocationPart {
  return part.type === "tool-invocation";
}

export function isImagePart(part: MessagePart): part is ImagePart {
  return part.type === "image";
}

export function isStatusPart(part: MessagePart): part is StatusPart {
  return part.type === "status";
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Filter parts by type with proper narrowing */
export function filterParts<T extends MessagePart["type"]>(
  parts: MessagePart[],
  type: T,
): Extract<MessagePart, { type: T }>[] {
  return parts.filter((p) => p.type === type) as Extract<
    MessagePart,
    { type: T }
  >[];
}
