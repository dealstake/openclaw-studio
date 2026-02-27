// ─── Trace Parser ─────────────────────────────────────────────────────────
// Pure functions to transform enhanced transcript messages into structured
// trace data for the Session Trace Viewer.

export type ToolCallTrace = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  durationMs?: number;
};

export type TraceTurn = {
  index: number;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls: ToolCallTrace[];
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  cost: {
    input: number;
    output: number;
    total: number;
  };
  model: string | null;
  stopReason: string | null;
  timestamp: number;
  latencyMs: number | null;
  thinkingContent?: string;
};

export type TraceNode = {
  id: string;
  type: "message" | "thinking" | "tool_call";
  role: "user" | "assistant" | "system";
  content: string;
  children: TraceNode[];
  depth: number;
  // Present on message nodes
  tokens?: TraceTurn["tokens"];
  cost?: TraceTurn["cost"];
  model?: string | null;
  stopReason?: string | null;
  timestamp?: number;
  latencyMs?: number | null;
  // Present on tool_call nodes
  toolCall?: ToolCallTrace;
};

export type TraceSummary = {
  sessionId: string;
  model: string | null;
  totalTurns: number;
  totalTokens: number;
  totalCost: number;
  totalDurationMs: number;
  turnBreakdown: { user: number; assistant: number; system: number; tool: number };
};

type ContentBlock = {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  content?: string | Array<{ type: string; text?: string }>;
  tool_use_id?: string;
  toolCallId?: string;
  toolName?: string;
  thinking?: string;
  [key: string]: unknown;
};

export type EnhancedTranscriptMessage = {
  id: string;
  role: string;
  content: string | ContentBlock[];
  timestamp: string;
  usage?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  };
  model?: string;
  stopReason?: string;
};

const EMPTY_TOKENS = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 };
const EMPTY_COST = { input: 0, output: 0, total: 0 };

/**
 * Extract text content from a message's content field.
 */
function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text!)
    .join("\n");
}

/**
 * Extract thinking content from content blocks.
 */
function extractThinkingContent(content: string | ContentBlock[]): string | undefined {
  if (typeof content === "string" || !Array.isArray(content)) return undefined;
  const thinking = content
    .filter((b) => b.type === "thinking" && (b.thinking || b.text))
    .map((b) => (b.thinking ?? b.text) as string)
    .join("\n");
  return thinking || undefined;
}

/**
 * Extract tool calls from assistant message content blocks.
 */
function extractToolCalls(content: string | ContentBlock[]): ToolCallTrace[] {
  if (typeof content === "string" || !Array.isArray(content)) return [];
  return content
    .filter((b) => b.type === "toolCall" || b.type === "tool_use")
    .map((b) => ({
      id: b.id ?? "",
      name: b.name ?? "",
      arguments: (b.input ?? (typeof b.arguments === "string" ? {} : (b.arguments as Record<string, unknown>))) ?? {},
    }));
}

/**
 * Parse enhanced transcript messages into structured trace turns and summary.
 */
export function parseTrace(
  messages: EnhancedTranscriptMessage[],
  sessionId: string,
): { turns: TraceTurn[]; summary: TraceSummary } {
  const turns: TraceTurn[] = [];
  let lastAssistantTimestamp: number | null = null;
  let inferredModel: string | null = null;

  // Build a map of tool results by toolCallId for matching
  const toolResultMap = new Map<string, { content: string; timestamp: number }>();
  for (const msg of messages) {
    if (msg.role === "toolResult" || msg.role === "tool") {
      const toolCallId =
        (msg as unknown as { toolCallId?: string }).toolCallId ??
        (msg as unknown as { tool_use_id?: string }).tool_use_id ??
        "";
      if (toolCallId) {
        const resultContent =
          typeof msg.content === "string"
            ? msg.content
            : Array.isArray(msg.content)
              ? msg.content
                  .filter((b) => b.type === "text" && b.text)
                  .map((b) => b.text!)
                  .join("\n")
              : "";
        toolResultMap.set(toolCallId, {
          content: resultContent,
          timestamp: new Date(msg.timestamp).getTime(),
        });
      }
    }
  }

  for (const msg of messages) {
    // Skip tool result messages — they're folded into the preceding assistant turn
    if (msg.role === "toolResult" || msg.role === "tool") continue;

    const role = msg.role === "user" ? "user" : msg.role === "assistant" ? "assistant" : "system";
    const timestamp = new Date(msg.timestamp).getTime();
    const textContent = extractTextContent(msg.content);
    const thinkingContent = extractThinkingContent(msg.content);
    const toolCalls = extractToolCalls(msg.content);

    // Match tool results to tool calls
    for (const tc of toolCalls) {
      const result = toolResultMap.get(tc.id);
      if (result) {
        tc.result = result.content;
        tc.durationMs = result.timestamp > timestamp ? result.timestamp - timestamp : undefined;
      }
    }

    // Calculate latency for assistant messages
    let latencyMs: number | null = null;
    if (role === "assistant" && lastAssistantTimestamp !== null) {
      latencyMs = timestamp - lastAssistantTimestamp;
    }
    if (role === "assistant") {
      lastAssistantTimestamp = timestamp;
    }

    // Track model
    if (msg.model) inferredModel = msg.model;

    const tokens = msg.usage
      ? {
          input: msg.usage.input,
          output: msg.usage.output,
          cacheRead: msg.usage.cacheRead,
          cacheWrite: msg.usage.cacheWrite,
          total: msg.usage.totalTokens,
        }
      : { ...EMPTY_TOKENS };

    const cost = msg.usage?.cost
      ? {
          input: msg.usage.cost.input,
          output: msg.usage.cost.output,
          total: msg.usage.cost.total,
        }
      : { ...EMPTY_COST };

    turns.push({
      index: turns.length,
      role,
      content: textContent,
      toolCalls,
      tokens,
      cost,
      model: msg.model ?? null,
      stopReason: msg.stopReason ?? null,
      timestamp,
      latencyMs,
      thinkingContent,
    });
  }

  // Build summary
  const totalTokens = turns.reduce((s, t) => s + t.tokens.total, 0);
  const totalCost = turns.reduce((s, t) => s + t.cost.total, 0);
  const timestamps = turns.map((t) => t.timestamp).filter((t) => t > 0);
  const totalDurationMs =
    timestamps.length >= 2 ? Math.max(...timestamps) - Math.min(...timestamps) : 0;

  const turnBreakdown = { user: 0, assistant: 0, system: 0, tool: 0 };
  for (const t of turns) {
    if (t.role === "user") turnBreakdown.user++;
    else if (t.role === "assistant") turnBreakdown.assistant++;
    else if (t.role === "system") turnBreakdown.system++;
    // Note: tool results are already filtered out above, but guard against future role additions
    else turnBreakdown.tool++;
  }

  return {
    turns,
    summary: {
      sessionId,
      model: inferredModel,
      totalTurns: turns.length,
      totalTokens,
      totalCost,
      totalDurationMs,
      turnBreakdown,
    },
  };
}

/**
 * Convert flat TraceTurn[] into a hierarchical TraceNode[] tree.
 * Each turn becomes a message node. Assistant turns with thinking or tool calls
 * get nested children (thinking node first, then tool_call nodes).
 */
export function turnsToTree(turns: TraceTurn[]): TraceNode[] {
  let nodeId = 0;
  const nodes: TraceNode[] = [];

  for (const turn of turns) {
    const children: TraceNode[] = [];

    // Thinking as a child of the assistant message
    if (turn.thinkingContent) {
      children.push({
        id: `node-${++nodeId}`,
        type: "thinking",
        role: turn.role,
        content: turn.thinkingContent,
        children: [],
        depth: 1,
      });
    }

    // Tool calls as children of the assistant message
    for (const tc of turn.toolCalls) {
      children.push({
        id: `node-${++nodeId}`,
        type: "tool_call",
        role: turn.role,
        content: tc.result ?? "",
        children: [],
        depth: 1,
        toolCall: tc,
      });
    }

    nodes.push({
      id: `node-${++nodeId}`,
      type: "message",
      role: turn.role,
      content: turn.content,
      children,
      depth: 0,
      tokens: turn.tokens,
      cost: turn.cost,
      model: turn.model,
      stopReason: turn.stopReason,
      timestamp: turn.timestamp,
      latencyMs: turn.latencyMs,
    });
  }

  return nodes;
}
