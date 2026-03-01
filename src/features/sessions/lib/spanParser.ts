// ─── Span Parser ───────────────────────────────────────────────────────────
// Pure functions to derive TraceSpan[] from raw JSONL transcript entries.
//
// This builds a two-level span hierarchy from the existing session JSONL data:
//
//   assistant message  →  llm_call span (root)
//   toolCall blocks    →  tool_call spans (children of the llm_call span)
//   toolResult msgs    →  close matching tool_call spans (sets endTime, durationMs, status)
//
// No gateway instrumentation required — all data is already in the JSONL.
// When the gateway adds native span emission in the future, this parser can
// be extended to merge/prefer native spans over derived ones.

import type { JsonlEntry } from "@/lib/sessions/traceParser";
import type {
  TraceSpan,
  TraceSpansSummary,
  TraceSpansResult,
  SpanCost,
  SpanTokens,
} from "./spanTypes";

// ─── Internal types ───────────────────────────────────────────────────────

/** Content block shape from the JSONL assistant message content array */
type ContentBlock = {
  type: string;
  id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  thinking?: string;
  text?: string;
  content?: string | Array<{ type: string; text?: string }>;
  tool_use_id?: string;
  toolCallId?: string;
  [key: string]: unknown;
};

/** Narrowed shape for toolResult message fields */
type ToolResultMessage = {
  role: "toolResult" | "tool";
  toolCallId?: string;
  tool_use_id?: string;
  isError?: boolean;
  details?: { status?: string };
  content?: string | ContentBlock[];
  timestamp?: number | string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Coerce a message timestamp to Unix ms. Returns 0 if unparseable. */
function toUnixMs(ts: unknown): number {
  if (typeof ts === "number") return ts;
  if (typeof ts === "string" && ts) {
    const parsed = Date.parse(ts);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/** Safely cast JsonlEntry.message to ToolResultMessage. */
function asToolResult(msg: unknown): ToolResultMessage | null {
  if (
    typeof msg !== "object" ||
    msg === null ||
    !("role" in msg) ||
    ((msg as { role: string }).role !== "toolResult" && (msg as { role: string }).role !== "tool")
  ) {
    return null;
  }
  return msg as ToolResultMessage;
}

/** Extract toolCallId from a toolResult message (handles both field names). */
function extractToolCallId(msg: ToolResultMessage): string {
  return (msg.toolCallId ?? msg.tool_use_id ?? "").trim();
}

/** Extract text from tool result content. Truncated to maxLen chars. */
function extractResultText(content: unknown, maxLen: number): string {
  if (typeof content === "string") return content.slice(0, maxLen);
  if (!Array.isArray(content)) return "";
  return (content as ContentBlock[])
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("\n")
    .slice(0, maxLen);
}

/** Compute a percentile from a sorted array of numbers. */
function percentile(sorted: number[], pct: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.ceil((pct / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Derive TraceSpan[] from raw JSONL entries for a session.
 *
 * Processes the entries in document order:
 * 1. assistant messages  → one llm_call span + N pending tool_call child spans
 * 2. toolResult messages → close matching tool_call spans
 *
 * Any tool_call span not closed by a toolResult stays in "pending" status
 * (can happen for in-progress or incomplete sessions).
 */
export function parseSpansFromJsonl(entries: JsonlEntry[], sessionId: string): TraceSpansResult {
  const spans: TraceSpan[] = [];

  // toolCallId → in-flight tool_call span (mutable reference — we update it in-place)
  const pendingToolSpans = new Map<string, TraceSpan>();

  let turnIndex = -1;
  let currentLlmSpanId: string | null = null;

  for (const entry of entries) {
    if (entry.type !== "message" || !entry.message) continue;

    const msg = entry.message;
    const entryTimestamp = toUnixMs(entry.timestamp);

    // ── Assistant message → llm_call span ──────────────────────────────
    if (msg.role === "assistant") {
      turnIndex++;
      const spanId = `span-llm-${turnIndex}`;
      currentLlmSpanId = spanId;

      const msgTimestamp = toUnixMs(msg.timestamp) || entryTimestamp;
      const contentBlocks: ContentBlock[] = Array.isArray(msg.content)
        ? (msg.content as ContentBlock[])
        : [];

      // Build output payload: first text block summary
      const textSummary = contentBlocks
        .filter((b) => b.type === "text" && typeof b.text === "string")
        .map((b) => b.text as string)
        .join(" ")
        .slice(0, 200)
        .trim();

      // Build tokens/cost from usage
      let tokens: SpanTokens | undefined;
      let cost: SpanCost | undefined;
      if (msg.usage) {
        tokens = {
          input: msg.usage.input,
          output: msg.usage.output,
          cacheRead: msg.usage.cacheRead,
          cacheWrite: msg.usage.cacheWrite,
          total: msg.usage.totalTokens,
        };
        if (msg.usage.cost) {
          cost = {
            input: msg.usage.cost.input,
            output: msg.usage.cost.output,
            cacheRead: msg.usage.cost.cacheRead,
            cacheWrite: msg.usage.cost.cacheWrite,
            total: msg.usage.cost.total,
          };
        }
      }

      const llmSpan: TraceSpan = {
        spanId,
        parentSpanId: null,
        traceId: sessionId,
        turnIndex,
        kind: "llm_call",
        name: msg.model ?? "llm",
        startTime: msgTimestamp,
        // endTime = startTime for llm_call (we don't separately track when the response arrived,
        // only when the next message is processed). The durationMs is 0 to indicate we measured
        // the call start, not the round-trip. Phase 2 will add proper latency bars.
        endTime: msgTimestamp,
        durationMs: 0,
        status: "ok",
        model: msg.model ?? null,
        stopReason: msg.stopReason ?? null,
        ...(tokens ? { tokens } : {}),
        ...(cost ? { cost } : {}),
        ...(textSummary ? { outputPayload: textSummary } : {}),
      };
      spans.push(llmSpan);

      // ── toolCall blocks → pending tool_call child spans ──────────────
      const toolCallBlocks = contentBlocks.filter(
        (b) => b.type === "toolCall" || b.type === "tool_use",
      );

      for (let i = 0; i < toolCallBlocks.length; i++) {
        const tc = toolCallBlocks[i];
        const tcSpanId = `span-tool-${turnIndex}-${i}`;
        const toolCallId = (tc.id ?? "").trim();

        const inputPayload = tc.arguments
          ? JSON.stringify(tc.arguments).slice(0, 500)
          : undefined;

        const toolSpan: TraceSpan = {
          spanId: tcSpanId,
          parentSpanId: spanId,
          traceId: sessionId,
          turnIndex,
          kind: "tool_call",
          name: tc.name ?? "tool",
          startTime: msgTimestamp,
          endTime: null,
          durationMs: null,
          status: "pending",
          ...(inputPayload ? { inputPayload } : {}),
        };
        spans.push(toolSpan);

        if (toolCallId) {
          pendingToolSpans.set(toolCallId, toolSpan);
        }
      }
      continue;
    }

    // ── toolResult message → close matching tool_call span ──────────────
    const toolResult = asToolResult(msg);
    if (toolResult) {
      const toolCallId = extractToolCallId(toolResult);
      const msgTimestamp = toUnixMs(
        (msg as unknown as { timestamp?: unknown }).timestamp,
      ) || entryTimestamp;

      if (toolCallId && pendingToolSpans.has(toolCallId)) {
        const toolSpan = pendingToolSpans.get(toolCallId)!;
        toolSpan.endTime = msgTimestamp;
        toolSpan.durationMs = msgTimestamp > toolSpan.startTime
          ? msgTimestamp - toolSpan.startTime
          : 0;

        // Determine status: check isError and details.status
        const isErr =
          toolResult.isError === true ||
          toolResult.details?.status === "error";
        toolSpan.status = isErr ? "error" : "ok";

        const resultText = extractResultText(toolResult.content, 300);
        if (resultText) toolSpan.outputPayload = resultText;

        pendingToolSpans.delete(toolCallId);
      }

      // Update the llm_call span endTime to the last toolResult timestamp
      // so the llm_call span covers its full execution window.
      if (currentLlmSpanId) {
        const llmSpan = spans.find((s) => s.spanId === currentLlmSpanId);
        if (llmSpan && msgTimestamp > llmSpan.startTime) {
          llmSpan.endTime = msgTimestamp;
          llmSpan.durationMs = msgTimestamp - llmSpan.startTime;
        }
      }
      continue;
    }
  }

  // Any tool spans not closed remain "pending" — no change needed.

  // ─── Build summary ──────────────────────────────────────────────────
  const llmSpans = spans.filter((s) => s.kind === "llm_call");
  const toolSpans = spans.filter((s) => s.kind === "tool_call");

  const totalTokens = llmSpans.reduce((sum, s) => sum + (s.tokens?.total ?? 0), 0);
  const totalCost = llmSpans.reduce((sum, s) => sum + (s.cost?.total ?? 0), 0);

  const allStarts = spans.map((s) => s.startTime).filter((t) => t > 0);
  const allEnds = spans.map((s) => s.endTime).filter((t): t is number => t !== null && t > 0);
  const totalDurationMs =
    allStarts.length > 0 && allEnds.length > 0
      ? Math.max(...allEnds) - Math.min(...allStarts)
      : 0;

  // LLM call latency percentiles (only for spans with real durationMs > 0)
  const llmLatencies = llmSpans
    .map((s) => s.durationMs)
    .filter((d): d is number => d !== null && d > 0)
    .sort((a, b) => a - b);

  const summary: TraceSpansSummary = {
    traceId: sessionId,
    totalSpans: spans.length,
    totalLlmCalls: llmSpans.length,
    totalToolCalls: toolSpans.length,
    totalTokens,
    totalCost,
    totalDurationMs,
    medianLlmLatencyMs: percentile(llmLatencies, 50),
    p95LlmLatencyMs: percentile(llmLatencies, 95),
  };

  return { spans, summary };
}
