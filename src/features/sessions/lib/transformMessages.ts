import type { MessagePart } from "@/lib/chat/types";

type ContentBlock =
  | { type: "text"; text?: string }
  | { type: "thinking"; thinking?: string; text?: string }
  | { type: "tool_use"; id?: string; name?: string; input?: unknown }
  | { type: "tool_result"; tool_use_id?: string; content?: string | ContentBlock[] }
  | { type: string; [key: string]: unknown };

type MessageLike = {
  role?: string;
  content?: string | ContentBlock[];
  text?: string;
};

/** Strip OpenClaw inbound metadata envelope from user messages. */
function stripInboundMetadata(text: string): string {
  const metaPattern = /^Conversation info \(untrusted metadata\):\s*```json\s*\{[\s\S]*?\}\s*```\s*/i;
  let cleaned = text.replace(metaPattern, "").trim();
  cleaned = cleaned.replace(/^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s+[A-Z]{2,4}\]\s*/i, "").trim();
  return cleaned || text;
}

/** Extract text from a content block or string. */
function extractText(content: string | ContentBlock[] | undefined): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b): b is { type: "text"; text?: string } => b.type === "text")
    .map((b) => b.text ?? "")
    .join("\n");
}

/** Extract tool result text from content (may be string or nested blocks). */
function extractToolResultText(content: string | ContentBlock[] | undefined): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.map((b) => (b as { text?: string }).text ?? "").join("\n");
}

/**
 * Transform an array of messages (from transcripts or session history) into
 * MessagePart[] suitable for display in AgentChatView.
 *
 * Handles:
 * - Plain text messages (user + assistant)
 * - Structured content arrays with thinking/tool_use blocks
 * - Tool role messages (tool_result)
 *
 * Note: This intentionally performs basic type-based extraction rather than
 * deep semantic analysis. The content block `type` field is sufficient for
 * all current rendering needs.
 */
export function transformMessagesToMessageParts(messages: MessageLike[]): MessagePart[] {
  const parts: MessagePart[] = [];
  // Track pending tool calls for matching with tool results
  const pendingTools = new Map<string, number>(); // toolCallId → index in parts
  let toolCallCounter = 0; // Unique fallback IDs for tool calls without explicit IDs

  for (const msg of messages) {
    const { role, content } = msg;

    // ── User messages ──
    if (role === "user") {
      const text = typeof content === "string"
        ? content
        : extractText(content) || msg.text || "";
      if (text) {
        parts.push({ type: "text", text: `> ${stripInboundMetadata(text)}` });
      }
      continue;
    }

    // ── Tool result messages ──
    if (role === "tool") {
      const toolUseId = (msg as Record<string, unknown>).tool_use_id as string | undefined;
      const resultText = typeof content === "string"
        ? content
        : extractToolResultText(content) || msg.text || "";

      if (toolUseId && pendingTools.has(toolUseId)) {
        // Update existing tool invocation part with result
        const idx = pendingTools.get(toolUseId)!;
        const existing = parts[idx];
        if (existing.type === "tool-invocation") {
          parts[idx] = {
            ...existing,
            phase: "complete",
            result: resultText || undefined,
          };
        }
        pendingTools.delete(toolUseId);
      } else if (resultText) {
        // Orphan tool result — render as text
        parts.push({ type: "text", text: resultText });
      }
      continue;
    }

    // ── Assistant messages ──
    if (typeof content === "string") {
      if (content) parts.push({ type: "text", text: content });
      continue;
    }

    if (Array.isArray(content)) {
      for (const block of content) {
        switch (block.type) {
          case "thinking": {
            const thinkText = (block as { thinking?: string; text?: string }).thinking
              ?? (block as { text?: string }).text ?? "";
            if (thinkText) {
              parts.push({ type: "reasoning", text: thinkText });
            }
            break;
          }
          case "tool_use": {
            const b = block as { id?: string; name?: string; input?: unknown };
            const toolCallId = b.id ?? `tool-${toolCallCounter++}`;
            const argsStr = b.input ? JSON.stringify(b.input) : undefined;
            const idx = parts.length;
            parts.push({
              type: "tool-invocation",
              toolCallId,
              name: b.name ?? "unknown",
              phase: "complete",
              args: argsStr,
            });
            if (b.id) pendingTools.set(b.id, idx);
            break;
          }
          case "text": {
            const t = (block as { text?: string }).text;
            if (t) parts.push({ type: "text", text: t });
            break;
          }
          default:
            // Unknown block type — skip
            break;
        }
      }
      continue;
    }

    // Fallback: use msg.text
    const fallback = msg.text ?? "";
    if (fallback) parts.push({ type: "text", text: fallback });
  }

  return parts;
}
