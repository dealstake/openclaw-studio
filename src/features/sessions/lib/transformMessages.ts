import type { MessagePart } from "@/lib/chat/types";

// Keep old import for backwards compat during migration
import { type AgentChatItem, buildFinalAgentChatItems } from "@/features/agents/components/chatItems";

type MessageLike = {
  role?: string;
  content?: string | Array<{ type: string; text?: string }>;
  text?: string;
};

/** Strip OpenClaw inbound metadata envelope from user messages. */
function stripInboundMetadata(text: string): string {
  const metaPattern = /^Conversation info \(untrusted metadata\):\s*```json\s*\{[\s\S]*?\}\s*```\s*/i;
  let cleaned = text.replace(metaPattern, "").trim();
  cleaned = cleaned.replace(/^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s+[A-Z]{2,4}\]\s*/i, "").trim();
  return cleaned || text;
}

/**
 * Transform an array of messages (from transcripts or session history) into
 * MessagePart[] suitable for display in AgentChatView.
 */
export function transformMessagesToMessageParts(messages: MessageLike[]): MessagePart[] {
  const parts: MessagePart[] = [];

  for (const msg of messages) {
    const text =
      typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? (msg.content.find((p) => p.type === "text") as { text?: string } | undefined)?.text ?? ""
          : msg.text ?? "";
    if (!text) continue;

    if (msg.role === "user") {
      const cleaned = stripInboundMetadata(text);
      parts.push({ type: "text", text: `> ${cleaned}` });
    } else {
      // Parse assistant messages: detect thinking blocks and tool blocks
      // For now, treat as plain text — structured tool/thinking detection
      // will be enhanced as the event handler produces richer parts
      parts.push({ type: "text", text });
    }
  }

  return parts;
}

/**
 * @deprecated Use transformMessagesToMessageParts instead.
 * Kept for backwards compatibility during Phase 3 migration.
 */
export function transformMessagesToChatItems(messages: MessageLike[]): AgentChatItem[] {
  const lines: string[] = [];
  for (const msg of messages) {
    const text =
      typeof msg.content === "string"
        ? msg.content
        : Array.isArray(msg.content)
          ? (msg.content.find((p) => p.type === "text") as { text?: string } | undefined)?.text ?? ""
          : msg.text ?? "";
    if (!text) continue;
    if (msg.role === "user") {
      const cleaned = stripInboundMetadata(text);
      lines.push(`> ${cleaned}`);
    } else {
      lines.push(text);
    }
  }
  return buildFinalAgentChatItems({
    outputLines: lines,
    showThinkingTraces: true,
    toolCallingEnabled: true,
  });
}
