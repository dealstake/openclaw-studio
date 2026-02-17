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
      lines.push(`> ${text}`);
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
