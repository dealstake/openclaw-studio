/**
 * Pure adapter: transforms MessagePart[] into props consumable by
 * AI Elements components (<Message>, <Reasoning>, <Tool>).
 *
 * This bridges our gateway-native type system with the presentational
 * components installed from Vercel AI Elements.
 */

import type {
  MessagePart,
  TextPart,
  ReasoningPart,
  ToolInvocationPart,
  StatusPart,
} from "./types";

// ── AI Elements–compatible prop types ──────────────────────────────────

export type ElementsTextProps = {
  type: "text";
  text: string;
  streaming: boolean;
};

export type ElementsReasoningProps = {
  type: "reasoning";
  text: string;
  streaming: boolean;
  durationSeconds: number | null;
};

export type ElementsToolProps = {
  type: "tool";
  toolCallId: string;
  name: string;
  state: "call" | "partial-call" | "result";
  args: string;
  result: string;
  isError: boolean;
  durationSeconds: number | null;
};

export type ElementsStatusProps = {
  type: "status";
  state: string;
  model: string | null;
  runStartedAt: number | null;
};

export type ElementsPart =
  | ElementsTextProps
  | ElementsReasoningProps
  | ElementsToolProps
  | ElementsStatusProps;

// ── Converters ─────────────────────────────────────────────────────────

function computeDuration(
  startedAt?: number,
  completedAt?: number,
): number | null {
  if (startedAt == null || completedAt == null) return null;
  const seconds = (completedAt - startedAt) / 1000;
  return Math.round(seconds * 10) / 10; // one decimal
}

function textToElements(part: TextPart): ElementsTextProps {
  return {
    type: "text",
    text: part.text,
    streaming: part.streaming ?? false,
  };
}

function reasoningToElements(part: ReasoningPart): ElementsReasoningProps {
  return {
    type: "reasoning",
    text: part.text,
    streaming: part.streaming ?? false,
    durationSeconds: computeDuration(part.startedAt, part.completedAt),
  };
}

function toolToElements(part: ToolInvocationPart): ElementsToolProps {
  const stateMap: Record<ToolInvocationPart["phase"], ElementsToolProps["state"]> = {
    pending: "call",
    running: "partial-call",
    complete: "result",
    error: "result",
  };

  return {
    type: "tool",
    toolCallId: part.toolCallId,
    name: part.name,
    state: stateMap[part.phase],
    args: part.args ?? "",
    result: part.result ?? "",
    isError: part.phase === "error",
    durationSeconds: computeDuration(part.startedAt, part.completedAt),
  };
}

function statusToElements(part: StatusPart): ElementsStatusProps {
  return {
    type: "status",
    state: part.state,
    model: part.model ?? null,
    runStartedAt: part.runStartedAt ?? null,
  };
}

// ── Main adapter ───────────────────────────────────────────────────────

const converters: Record<
  MessagePart["type"],
  (part: never) => ElementsPart
> = {
  text: textToElements as (part: never) => ElementsPart,
  reasoning: reasoningToElements as (part: never) => ElementsPart,
  "tool-invocation": toolToElements as (part: never) => ElementsPart,
  image: textToElements as (part: never) => ElementsPart, // Images rendered directly by AgentChatView, not via Elements
  status: statusToElements as (part: never) => ElementsPart,
};

/**
 * Convert an array of `MessagePart` (gateway-native) into
 * AI Elements–compatible props arrays.
 */
export function gatewayToElements(parts: MessagePart[]): ElementsPart[] {
  return parts.map((part) => converters[part.type](part as never));
}
