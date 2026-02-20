/**
 * Hook that consumes the same gateway WebSocket events as `buildAgentChatItems`
 * but produces structured `MessagePart[]` for the new chat rendering pipeline.
 *
 * Inputs mirror `BuildAgentChatItemsInput` from `chatItems.ts`:
 * - outputLines: finalized turn lines from gateway
 * - streamText: live streaming assistant text (null when idle)
 * - liveThinkingTrace: live thinking/reasoning text
 *
 * Reuses parsing logic from `message-extract.ts` (isTraceMarkdown, isToolMarkdown, etc.).
 */

import { useMemo } from "react";
import {
  isTraceMarkdown,
  isToolMarkdown,
  parseToolMarkdown,
  stripTraceMarkdown,
} from "@/lib/text/message-extract";
import type { MessagePart } from "./types";

// ── Pure parser (no React, testable standalone) ────────────────────────

export type ParseMessagePartsInput = {
  outputLines: string[];
  streamText: string | null;
  liveThinkingTrace: string;
};

/**
 * Strip OpenClaw inbound metadata envelope from user-quoted lines.
 * Matches the same logic as `stripInboundMetadata` in chatItems.ts.
 */
function stripInboundMetadata(text: string): string {
  const metaPattern =
    /^Conversation info \(untrusted metadata\):\s*```json\s*\{[\s\S]*?\}\s*```\s*/i;
  let cleaned = text.replace(metaPattern, "").trim();
  cleaned = cleaned
    .replace(
      /^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s+[A-Z]{2,4}\]\s*/i,
      "",
    )
    .trim();
  return cleaned || text;
}

/** Normalize assistant text — collapse redundant blank lines, trim trailing whitespace. */
function normalizeText(value: string): string {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const normalized: string[] = [];
  let lastWasBlank = false;
  for (const rawLine of lines) {
    const line = rawLine.replace(/[ \t]+$/g, "");
    if (line.trim().length === 0) {
      if (lastWasBlank) continue;
      normalized.push("");
      lastWasBlank = true;
      continue;
    }
    normalized.push(line);
    lastWasBlank = false;
  }
  return normalized.join("\n").trim();
}

/**
 * Parse a tool markdown line into a ToolInvocationPart.
 * Uses `parseToolMarkdown` from message-extract.ts.
 */
function toolLineToPart(line: string): MessagePart {
  const parsed = parseToolMarkdown(line);
  // Extract tool name from the label (e.g., "web_search (call_123)" → "web_search")
  const nameMatch = parsed.label.match(/^(\S+)/);
  const name = nameMatch?.[1] ?? parsed.label;
  // Extract tool call ID from parenthetical if present
  const idMatch = parsed.label.match(/\(([^)]+)\)/);
  const toolCallId = idMatch?.[1] ?? "";

  return {
    type: "tool-invocation",
    toolCallId,
    name,
    phase: parsed.kind === "result" ? "complete" : "running",
    args: parsed.kind === "call" ? parsed.body : undefined,
    result: parsed.kind === "result" ? parsed.body : undefined,
  };
}

/**
 * Parse gateway output lines + live streams into structured MessagePart[].
 * Pure function — no React dependency, easily unit-testable.
 */
export function parseMessageParts(input: ParseMessagePartsInput): MessagePart[] {
  const { outputLines, streamText, liveThinkingTrace } = input;
  const parts: MessagePart[] = [];

  // Helper to merge consecutive reasoning parts
  const appendReasoning = (text: string, streaming?: boolean) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const last = parts[parts.length - 1];
    if (last?.type === "reasoning") {
      if (trimmed.startsWith(last.text)) {
        last.text = trimmed;
      } else if (!last.text.startsWith(trimmed)) {
        last.text = `${last.text}\n\n${trimmed}`;
      }
      if (streaming) last.streaming = true;
      return;
    }
    parts.push({ type: "reasoning", text: trimmed, streaming });
  };

  for (const line of outputLines) {
    if (!line) continue;

    // Thinking/reasoning trace
    if (isTraceMarkdown(line)) {
      const text = stripTraceMarkdown(line).trim();
      if (text) appendReasoning(text);
      continue;
    }

    // Tool call or result
    if (isToolMarkdown(line)) {
      parts.push(toolLineToPart(line));
      continue;
    }

    // User-quoted line (starts with >)
    const trimmed = line.trim();
    if (trimmed.startsWith(">")) {
      const text = stripInboundMetadata(trimmed.replace(/^>\s?/, "").trim());
      if (text) {
        parts.push({ type: "text", text });
      }
      continue;
    }

    // Assistant text
    const normalizedText = normalizeText(line);
    if (normalizedText) {
      parts.push({ type: "text", text: normalizedText });
    }
  }

  // Live thinking trace (append as streaming reasoning)
  if (liveThinkingTrace) {
    const cleaned = liveThinkingTrace.trim();
    if (cleaned) {
      appendReasoning(cleaned, true);
    }
  }

  // Live stream text (append as streaming text)
  const liveStream = streamText?.trim();
  if (liveStream) {
    const normalizedStream = normalizeText(liveStream);
    if (normalizedStream) {
      parts.push({ type: "text", text: normalizedStream, streaming: true });
    }
  }

  return parts;
}

// ── React hook ─────────────────────────────────────────────────────────

export type UseMessagePartsInput = {
  outputLines: string[];
  streamText: string | null;
  liveThinkingTrace: string;
};

/**
 * React hook that memoizes `parseMessageParts` output.
 *
 * Uses primitive deps (line count, stream text, thinking trace) to avoid
 * recomputing when the outputLines array identity changes but content hasn't.
 */
export function useMessageParts(input: UseMessagePartsInput): MessagePart[] {
  const { outputLines, streamText, liveThinkingTrace } = input;

  return useMemo(
    () => parseMessageParts({ outputLines, streamText, liveThinkingTrace }),
    [outputLines, streamText, liveThinkingTrace],
  );
}
