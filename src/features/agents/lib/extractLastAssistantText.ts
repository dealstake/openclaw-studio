import type { MessagePart } from "@/lib/chat/types";
import { isTextPart } from "@/lib/chat/types";
import { isInternalSystemLine } from "@/lib/chat/parseMessageParts";

/**
 * Extract the last assistant response text from message parts.
 *
 * Finds the boundary of the most recent assistant turn by scanning backwards
 * for a status part with state "running", "ended", or "idle", then collects
 * text parts after that boundary — filtering out quoted lines and internal
 * system content.
 *
 * Used for TTS and preview purposes.
 */
export function extractLastAssistantText(
  messageParts: MessagePart[],
): string | undefined {
  if (messageParts.length === 0) return undefined;

  // Find the start of the last assistant response by scanning backwards
  // for a status marker that delimits turn boundaries.
  let startIdx = 0;
  for (let i = messageParts.length - 1; i >= 0; i--) {
    const part = messageParts[i];
    if (part.type !== "status") continue;
    const state = (part as { state?: string }).state;
    if (state === "running" || state === "ended" || state === "idle" || state === "complete" || state === "error") {
      startIdx = i + 1;
      break;
    }
  }

  const recentParts = messageParts.slice(startIdx);
  const textParts = recentParts
    .filter(isTextPart)
    .filter((p) => {
      const trimmed = p.text.trim();
      // Skip user-quoted lines (echoed back in assistant text)
      if (trimmed.startsWith(">")) return false;
      // Skip internal system/infrastructure messages
      if (isInternalSystemLine(trimmed)) return false;
      return true;
    });

  if (textParts.length === 0) return undefined;
  return textParts.map((p) => p.text).join("");
}
