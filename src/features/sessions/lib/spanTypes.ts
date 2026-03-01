// ─── Span Types ────────────────────────────────────────────────────────────
// Schema for request-level LLM trace spans.
//
// A "span" represents one unit of work within a session turn:
//   - llm_call: A single LLM API request (e.g., one call to claude-sonnet-4-6)
//   - tool_call: A single tool invocation (e.g., exec, read, web_search)
//
// Spans form a parent-child tree:
//   session (root)
//   └── llm_call (turn 0)
//       ├── tool_call (exec)
//       └── tool_call (read)
//   └── llm_call (turn 1)
//       └── tool_call (web_search)

export type SpanStatus = "ok" | "error" | "pending";
export type SpanKind = "llm_call" | "tool_call";

export type SpanTokens = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
};

export type SpanCost = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  total: number;
};

/**
 * A single instrumentation span representing one unit of work within a session turn.
 *
 * Derived from JSONL transcript data:
 *   - assistant messages    → llm_call spans
 *   - toolCall content blocks → tool_call spans (children of the llm_call)
 *   - toolResult messages   → close the matching tool_call span
 */
export type TraceSpan = {
  /** Unique span ID within this trace (stable: "span-llm-{turnIdx}" / "span-tool-{turnIdx}-{i}") */
  spanId: string;
  /** Parent span ID. null for llm_call root spans. */
  parentSpanId: string | null;
  /** Trace ID — maps 1:1 to sessionId */
  traceId: string;
  /** Turn index within the session (0-based, increments per assistant message) */
  turnIndex: number;
  /** Span classification */
  kind: SpanKind;
  /** Human-readable name: model name for llm_call, tool name for tool_call */
  name: string;
  /** Unix ms timestamp when this span started */
  startTime: number;
  /** Unix ms timestamp when this span ended (null = still running / not yet closed) */
  endTime: number | null;
  /** Duration in milliseconds (null if span hasn't ended) */
  durationMs: number | null;
  /** Execution status */
  status: SpanStatus;
  /** Token usage — llm_call only */
  tokens?: SpanTokens;
  /** Cost breakdown — llm_call only */
  cost?: SpanCost;
  /** Model identifier (e.g., "claude-sonnet-4-6") — llm_call only */
  model?: string | null;
  /** LLM stop reason (e.g., "toolUse", "end_turn") — llm_call only */
  stopReason?: string | null;
  /** Serialized input: tool arguments (tool_call) or prompt summary (llm_call). Truncated to 500 chars. */
  inputPayload?: string;
  /** Serialized output: tool result (tool_call) or response summary (llm_call). Truncated to 300 chars. */
  outputPayload?: string;
};

export type TraceSpansSummary = {
  /** Maps to sessionId */
  traceId: string;
  totalSpans: number;
  totalLlmCalls: number;
  totalToolCalls: number;
  totalTokens: number;
  totalCost: number;
  /** Wall-clock duration from first span start to last span end */
  totalDurationMs: number;
  /** Median LLM API call latency in ms (null if no llm_call spans) */
  medianLlmLatencyMs: number | null;
  /** P95 LLM API call latency in ms (null if fewer than 2 llm_call spans) */
  p95LlmLatencyMs: number | null;
};

export type TraceSpansResult = {
  summary: TraceSpansSummary;
  spans: TraceSpan[];
};
