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

import {
  isTraceMarkdown,
  isToolMarkdown,
  parseToolMarkdown,
  stripTraceMarkdown,
} from "@/lib/text/message-extract";
import type { MessagePart } from "./types";

import { stripAnsi } from "@/lib/stripAnsi";

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
  const lines = stripAnsi(value).replace(/\r\n?/g, "\n").split("\n");
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
 * Detect internal system/infrastructure lines that should be hidden from
 * the user-facing chat stream. These include compaction prompts, heartbeat
 * tokens, post-compaction audit notices, and bare "NO_REPLY" responses.
 */
export function isInternalSystemLine(line: string): boolean {
  const trimmed = line.trim();

  // Exact match tokens
  if (trimmed === "NO_REPLY" || trimmed === "HEARTBEAT_OK") return true;

  // System-tagged lines: "System: [timestamp] ⚠ Post-Compaction Audit..."
  if (/^System:\s*\[/.test(trimmed)) return true;

  // Compaction memory flush prompts
  if (trimmed.includes("Pre-compaction memory flush") || trimmed.includes("Post-Compaction Audit")) return true;

  // Heartbeat prompts
  if (trimmed.startsWith("Heartbeat prompt:") || trimmed.includes("HEARTBEAT_OK")) return true;

  // Internal operational instructions that leaked into output
  if (trimmed.includes("Store durable memories now") && trimmed.includes("memory/")) return true;

  return false;
}

/**
 * Parse gateway output lines + live streams into structured MessagePart[].
 * Pure function — no React dependency, easily unit-testable.
 */
export function parseMessageParts(input: ParseMessagePartsInput): MessagePart[] {
  const { outputLines, streamText, liveThinkingTrace } = input;
  const parts: MessagePart[] = [];

  // Track tool call parts by toolCallId so results can merge into them
  const pendingToolsByCallId = new Map<string, number>(); // toolCallId → index in parts

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

    // Filter out internal system/infrastructure messages that should never
    // appear in the user-facing chat stream (compaction prompts, heartbeat
    // tokens, audit notices, etc.)
    if (isInternalSystemLine(line)) continue;

    // Thinking/reasoning trace
    if (isTraceMarkdown(line)) {
      const text = stripTraceMarkdown(line).trim();
      if (text) appendReasoning(text);
      continue;
    }

    // Tool call or result — merge results into matching call parts
    if (isToolMarkdown(line)) {
      const part = toolLineToPart(line);
      if (part.type === "tool-invocation") {
        const { toolCallId } = part;

        if (part.phase === "complete" && toolCallId && pendingToolsByCallId.has(toolCallId)) {
          // Tool result — merge into the existing call part
          const idx = pendingToolsByCallId.get(toolCallId)!;
          const existing = parts[idx];
          if (existing.type === "tool-invocation") {
            parts[idx] = { ...existing, phase: "complete", result: part.result };
          }
          pendingToolsByCallId.delete(toolCallId);
        } else {
          // Tool call (or orphan result) — add as new part
          // No toolCallId = can't match a result, mark complete immediately
          const effectivePart = !toolCallId && part.phase !== "complete"
            ? { ...part, phase: "complete" as const }
            : part;
          const idx = parts.length;
          parts.push(effectivePart);
          if (toolCallId && effectivePart.phase !== "complete") {
            pendingToolsByCallId.set(toolCallId, idx);
          }
        }
      } else {
        parts.push(part);
      }
      continue;
    }

    // User-quoted line (starts with >)
    // Preserve the ">" prefix so groupParts in AgentChatView can detect user
    // messages. The UserMessage component strips it at render time.
    const trimmed = line.trim();
    if (trimmed.startsWith(">")) {
      const inner = stripInboundMetadata(trimmed.replace(/^>\s?/, "").trim());
      if (inner) {
        parts.push({ type: "text", text: `> ${inner}` });
      }
      continue;
    }

    // Assistant text
    const normalizedText = normalizeText(line);
    if (normalizedText) {
      parts.push({ type: "text", text: normalizedText });
    }
  }

  // Any unmatched tool calls from history are done — mark them complete.
  // This handles cases where tool result lines are missing or in a different message.
  for (const idx of pendingToolsByCallId.values()) {
    const part = parts[idx];
    if (part?.type === "tool-invocation" && part.phase === "running") {
      parts[idx] = { ...part, phase: "complete" };
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

// useMessageParts hook removed — consumers use parseMessageParts directly
