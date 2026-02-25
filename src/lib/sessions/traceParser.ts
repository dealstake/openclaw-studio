export type JsonlEntry = {
  type: string;
  id?: string;
  parentId?: string | null;
  timestamp?: string;
  message?: {
    role: string;
    content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
    usage?: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
      totalTokens: number;
      cost: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
        total: number;
      };
    };
    model?: string;
    stopReason?: string;
    timestamp?: string;
  };
  [key: string]: unknown;
};

export type TraceMessage = {
  id: string;
  role: string;
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
  timestamp: string;
  usage?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    cost: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
      total: number;
    };
  };
  model?: string;
  stopReason?: string;
};

/**
 * Parse a raw JSONL entry into a TraceMessage.
 * Returns null if the entry is not a valid message.
 */
export function parseJsonlEntryToTraceMessage(
  entry: JsonlEntry,
): TraceMessage | null {
  if (entry.type !== "message" || !entry.message) return null;

  const msg = entry.message;
  return {
    id: entry.id ?? crypto.randomUUID(),
    role: msg.role,
    content: msg.content,
    timestamp: msg.timestamp ?? entry.timestamp ?? "",
    ...(msg.usage ? { usage: msg.usage } : {}),
    ...(msg.model ? { model: msg.model } : {}),
    ...(msg.stopReason ? { stopReason: msg.stopReason } : {}),
  };
}
