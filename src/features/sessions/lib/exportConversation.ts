import { fetchTranscriptMessages } from "../hooks/useTranscripts";
import { transformMessagesToMessageParts } from "./transformMessages";
import type { MessagePart } from "@/lib/chat/types";

/**
 * Export a session conversation as a Markdown file and trigger download.
 */
export async function exportConversationAsMarkdown(
  agentId: string,
  sessionKey: string,
  displayName: string,
): Promise<void> {
  // Parse sessionId from composite key (e.g. "agent:alex:main" → "main")
  const parts = sessionKey.split(":");
  const sessionId = parts.length >= 3 ? parts.slice(2).join(":") : sessionKey;

  let messages;
  try {
    const result = await fetchTranscriptMessages(agentId, sessionId, 0, 10000);
    messages = result.messages;
  } catch (error) {
    console.error("Failed to fetch transcript for export:", error);
    throw new Error("Failed to fetch conversation history for export.");
  }
  const messageParts = transformMessagesToMessageParts(messages);

  const lines: string[] = [];
  lines.push(`# ${displayName}`);
  lines.push("");
  lines.push(`*Exported on ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}*`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const part of messageParts) {
    switch (part.type) {
      case "text": {
        const text = (part as MessagePart & { text: string }).text;
        // User messages are prefixed with "> " by transformMessages
        if (text.startsWith("> ")) {
          lines.push("**User:**");
          lines.push("");
          lines.push(text);
          lines.push("");
        } else {
          lines.push("**Assistant:**");
          lines.push("");
          lines.push(text);
          lines.push("");
        }
        break;
      }
      case "reasoning": {
        const text = (part as MessagePart & { text: string }).text;
        lines.push("<details>");
        lines.push("<summary>💭 Thinking</summary>");
        lines.push("");
        lines.push(text);
        lines.push("");
        lines.push("</details>");
        lines.push("");
        break;
      }
      case "tool-invocation": {
        const tool = part as MessagePart & { name: string; result?: string };
        lines.push(`\`🔧 ${tool.name}\``);
        lines.push("");
        break;
      }
      default:
        break;
    }
  }

  const markdown = lines.join("\n");
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${displayName.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "conversation"}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
