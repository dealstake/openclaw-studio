/**
 * Retroactive heartbeat detection for historical messages.
 *
 * Live messages use the gateway's `isHeartbeat` tag. Historical messages
 * (loaded from session transcripts) lack this tag, so we use lightweight
 * pattern matching on message content as a fallback.
 *
 * After transformMessagesToMessageParts, user messages are TextParts prefixed
 * with "> " and assistant messages are plain TextParts. We detect heartbeat
 * turns by matching user prompt patterns and HEARTBEAT_OK responses.
 */

import type { MessagePart } from "@/lib/chat/types";

/** Patterns that indicate a heartbeat user prompt (applied after "> " prefix strip). */
const HEARTBEAT_USER_PATTERNS = [
  /read\s+heartbeat\.md/i,
  /check\s+heartbeat/i,
  /\bHEARTBEAT\.md\b/,
];

/** Patterns that indicate a heartbeat-ok assistant response. */
const HEARTBEAT_OK_PATTERN = /HEARTBEAT_OK/i;

/**
 * Returns true if a text part looks like a heartbeat user prompt.
 * User messages from transformMessagesToMessageParts start with "> ".
 */
function isHeartbeatUserPart(part: MessagePart): boolean {
  if (part.type !== "text") return false;
  const text = part.text ?? "";
  if (!text.startsWith("> ")) return false;
  const content = text.slice(2);
  return HEARTBEAT_USER_PATTERNS.some((p) => p.test(content));
}

/**
 * Returns true if a text part looks like a HEARTBEAT_OK assistant response.
 * Assistant messages are plain text (no "> " prefix).
 */
function isHeartbeatOkPart(part: MessagePart): boolean {
  if (part.type !== "text") return false;
  const text = part.text ?? "";
  if (text.startsWith("> ")) return false; // user message
  return HEARTBEAT_OK_PATTERN.test(text);
}

/**
 * Filters heartbeat-ok turns from historical message parts.
 *
 * A "heartbeat turn" is a user message matching heartbeat patterns followed
 * by an assistant response that is HEARTBEAT_OK. Alert heartbeats (non-OK
 * responses) are kept since they contain actionable information.
 *
 * Returns a new array with heartbeat-ok turns removed.
 */
export function filterHeartbeatTurns(parts: MessagePart[]): MessagePart[] {
  if (parts.length === 0) return parts;

  const indicesToRemove = new Set<number>();

  for (let i = 0; i < parts.length; i++) {
    if (!isHeartbeatUserPart(parts[i])) continue;

    // Found a heartbeat user message — scan forward for the next text part
    let j = i + 1;
    while (j < parts.length && parts[j].type !== "text") j++;

    if (j < parts.length && isHeartbeatOkPart(parts[j])) {
      // Mark entire turn for removal (user + intermediate parts + ok response)
      for (let k = i; k <= j; k++) indicesToRemove.add(k);
    }
    // Alert responses are kept
  }

  if (indicesToRemove.size === 0) return parts;
  return parts.filter((_, idx) => !indicesToRemove.has(idx));
}
