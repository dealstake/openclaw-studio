/**
 * Shared utility to extract text from gateway message payloads.
 *
 * Handles three shapes:
 *   1. { text: "..." }
 *   2. { content: "..." }
 *   3. { content: [{ type: "text", text: "..." }, ...] }
 */

export interface MessagePayload {
  text?: string;
  content?: string | Array<{ type?: string; text?: string }>;
}

export function extractMessageText(
  message: MessagePayload | undefined | null,
): string | null {
  if (!message) return null;
  if (typeof message.text === "string") return message.text;
  if (typeof message.content === "string") return message.content;
  if (Array.isArray(message.content)) {
    const texts = message.content
      .filter((p): p is { type?: string; text?: string } => !!p && typeof p === "object")
      .filter((p) => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text as string);
    return texts.length > 0 ? texts.join("") : null;
  }
  return null;
}
