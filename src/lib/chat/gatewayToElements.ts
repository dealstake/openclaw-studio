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
  ImagePart,
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

export type ElementsImageProps = {
  type: "image";
  src: string;
  alt: string;
};

export type ElementsPart =
  | ElementsTextProps
  | ElementsReasoningProps
  | ElementsToolProps
  | ElementsStatusProps
  | ElementsImageProps;

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

function imageToElements(part: ImagePart): ElementsImageProps {
  return {
    type: "image",
    src: part.src,
    alt: part.alt ?? "",
  };
}

// ── Main adapter ───────────────────────────────────────────────────────

/**
 * Convert an array of `MessagePart` (gateway-native) into
 * AI Elements–compatible props arrays.
 */
export function gatewayToElements(parts: MessagePart[]): ElementsPart[] {
  return parts.map((part): ElementsPart => {
    switch (part.type) {
      case "text":
        return textToElements(part);
      case "reasoning":
        return reasoningToElements(part);
      case "tool-invocation":
        return toolToElements(part);
      case "status":
        return statusToElements(part);
      case "image":
        return imageToElements(part);
    }
  });
}
