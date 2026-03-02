/**
 * Tool-level metrics types and extraction logic.
 *
 * Parses tool_use / tool_result blocks from stored session transcripts
 * to aggregate per-tool performance data (invocations, errors, latency).
 */

// ─── Types ──────────────────────────────────────────────────────────────────

/** Aggregated performance metrics for a single tool. */
export interface ToolMetric {
  toolName: string;
  invocations: number;
  errorCount: number;
  /** Error rate as fraction 0.0–1.0 */
  errorRate: number;
  avgLatencyMs: number;
  /** Most recent error message, if any */
  lastError: string | null;
  /** Last 7 days of daily error rates for sparkline (0.0–1.0 per day) */
  errorRateTrend: number[];
}

/** A single tool invocation extracted from a transcript. */
export interface ToolInvocation {
  toolName: string;
  isError: boolean;
  /** Estimated latency in ms (from message timestamps, if available) */
  latencyMs: number | null;
  errorMessage: string | null;
  /** ISO timestamp of the invocation */
  timestamp: string | null;
}

// ─── Transcript Parsing ─────────────────────────────────────────────────────

/**
 * Content block shape in Anthropic-style transcripts.
 * Minimal subset needed for tool extraction.
 */
interface ContentBlock {
  type: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string | ContentBlock[];
  is_error?: boolean;
}

interface TranscriptMessage {
  role?: string;
  content?: string | ContentBlock[];
  timestamp?: string;
  tool_use_id?: string;
  is_error?: boolean;
}

/**
 * Extract tool invocations from a transcript JSON string.
 * Handles both Anthropic-style (content blocks) and OpenAI-style (tool_calls).
 */
export function extractToolInvocations(transcriptJson: string): ToolInvocation[] {
  let messages: TranscriptMessage[];
  try {
    const parsed = JSON.parse(transcriptJson);
    messages = Array.isArray(parsed) ? parsed : (parsed?.messages ?? []);
  } catch {
    return [];
  }

  const invocations: ToolInvocation[] = [];
  // Map tool_use IDs to their data for pairing with results
  const pendingCalls = new Map<string, { name: string; timestamp: string | null; index: number }>();

  for (const msg of messages) {
    const blocks = Array.isArray(msg.content) ? msg.content : [];

    if (msg.role === "assistant") {
      for (const block of blocks) {
        if (block.type === "tool_use" && block.name) {
          const invocation: ToolInvocation = {
            toolName: block.name,
            isError: false,
            latencyMs: null,
            errorMessage: null,
            timestamp: msg.timestamp ?? null,
          };
          invocations.push(invocation);
          if (block.id) {
            pendingCalls.set(block.id, {
              name: block.name,
              timestamp: msg.timestamp ?? null,
              index: invocations.length - 1,
            });
          }
        }
      }
    }

    // Match tool_result blocks to their tool_use calls
    if (msg.role === "tool") {
      const toolUseId =
        msg.tool_use_id ??
        (blocks.length > 0 ? blocks[0]?.tool_use_id : undefined);

      if (toolUseId && pendingCalls.has(toolUseId)) {
        const pending = pendingCalls.get(toolUseId)!;
        const inv = invocations[pending.index];
        if (inv) {
          // Check for error
          const isError =
            msg.is_error === true ||
            blocks.some((b) => b.is_error === true || b.type === "error");
          if (isError) {
            inv.isError = true;
            inv.errorMessage = extractErrorText(msg);
          }
          // Estimate latency from timestamps
          if (pending.timestamp && msg.timestamp) {
            const start = new Date(pending.timestamp).getTime();
            const end = new Date(msg.timestamp).getTime();
            if (!isNaN(start) && !isNaN(end) && end > start) {
              inv.latencyMs = end - start;
            }
          }
        }
        pendingCalls.delete(toolUseId);
      }
    }
  }

  return invocations;
}

function extractErrorText(msg: TranscriptMessage): string | null {
  if (typeof msg.content === "string") return msg.content.slice(0, 200);
  if (Array.isArray(msg.content)) {
    for (const block of msg.content) {
      if (typeof block.content === "string") return block.content.slice(0, 200);
    }
  }
  return null;
}

// ─── Aggregation ────────────────────────────────────────────────────────────

/**
 * Aggregate tool invocations into per-tool metrics.
 * Optionally computes 7-day error rate trend.
 */
export function aggregateToolMetrics(
  invocations: ToolInvocation[],
  options?: { trendDays?: number },
): ToolMetric[] {
  const trendDays = options?.trendDays ?? 7;
  const now = Date.now();
  const dayMs = 86_400_000;

  // Group by tool name
  const byTool = new Map<
    string,
    {
      invocations: number;
      errors: number;
      latencies: number[];
      lastError: string | null;
      dailyInvocations: Map<number, { total: number; errors: number }>;
    }
  >();

  for (const inv of invocations) {
    let entry = byTool.get(inv.toolName);
    if (!entry) {
      entry = {
        invocations: 0,
        errors: 0,
        latencies: [],
        lastError: null,
        dailyInvocations: new Map(),
      };
      byTool.set(inv.toolName, entry);
    }

    entry.invocations++;
    if (inv.isError) {
      entry.errors++;
      entry.lastError = inv.errorMessage;
    }
    if (inv.latencyMs !== null) {
      entry.latencies.push(inv.latencyMs);
    }

    // Daily bucketing for trend
    if (inv.timestamp) {
      const ts = new Date(inv.timestamp).getTime();
      if (!isNaN(ts)) {
        const dayIndex = Math.floor((now - ts) / dayMs);
        if (dayIndex >= 0 && dayIndex < trendDays) {
          let daily = entry.dailyInvocations.get(dayIndex);
          if (!daily) {
            daily = { total: 0, errors: 0 };
            entry.dailyInvocations.set(dayIndex, daily);
          }
          daily.total++;
          if (inv.isError) daily.errors++;
        }
      }
    }
  }

  // Build metrics array
  const metrics: ToolMetric[] = [];
  for (const [toolName, data] of byTool) {
    const avgLatency =
      data.latencies.length > 0
        ? data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length
        : 0;

    // Build trend (oldest day first)
    const trend: number[] = [];
    for (let i = trendDays - 1; i >= 0; i--) {
      const daily = data.dailyInvocations.get(i);
      trend.push(daily && daily.total > 0 ? daily.errors / daily.total : 0);
    }

    metrics.push({
      toolName,
      invocations: data.invocations,
      errorCount: data.errors,
      errorRate: data.invocations > 0 ? data.errors / data.invocations : 0,
      avgLatencyMs: Math.round(avgLatency),
      lastError: data.lastError,
      errorRateTrend: trend,
    });
  }

  // Sort by invocations desc
  metrics.sort((a, b) => b.invocations - a.invocations);
  return metrics;
}
