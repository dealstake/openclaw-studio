import { type AgentChatItem, buildFinalAgentChatItems } from "@/features/agents/components/chatItems";

type MessageLike = {
  role?: string;
  content?: string | Array<{ type: string; text?: string }>;
  text?: string;
};

/**
 * Transform an array of messages (from transcripts or session history) into
 * AgentChatItems suitable for display in the chat viewer.
 *
 * This consolidates duplicate transform logic previously in page.tsx's
 * onTranscriptClick and onSessionClick handlers.
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
      // Strip OpenClaw inbound metadata envelope before display
      const metaPattern = /^Conversation info \(untrusted metadata\):\s*```json\s*\{[\s\S]*?\}\s*```\s*/i;
      let cleaned = text.replace(metaPattern, "").trim();
      cleaned = cleaned.replace(/^\[(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}\s+[A-Z]{2,4}\]\s*/i, "").trim();
      lines.push(`> ${cleaned || text}`);
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
