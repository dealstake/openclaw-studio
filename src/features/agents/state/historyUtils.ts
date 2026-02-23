import type { AgentState } from "./store";
import type {
  ChatHistoryMessage,
  HistoryLinesResult,
  HistorySyncPatchInput,
} from "./runtimeEventBridge.types";
import {
  extractText,
  extractThinking,
  extractToolLines,
  extractImages,
  formatThinkingMarkdown,
  isHeartbeatPrompt,
  stripUiMetadata,
} from "@/lib/text/message-extract";
import { parseMessageParts } from "@/lib/chat/parseMessageParts";
import { extractMessageTimestamp } from "./timestampUtils";

export const buildHistoryLines = (messages: ChatHistoryMessage[]): HistoryLinesResult => {
  const lines: string[] = [];
  let lastAssistant: string | null = null;
  let lastAssistantAt: number | null = null;
  let lastRole: string | null = null;
  let lastUser: string | null = null;
  // Track heartbeat turns: when a heartbeat user prompt is detected,
  // skip ALL subsequent messages (tool calls, assistant responses) until
  // the next non-heartbeat user message. This prevents tool call blocks
  // and heartbeat status reports from appearing in the main chat.
  let inHeartbeatTurn = false;
  for (const message of messages) {
    const role = typeof message.role === "string" ? message.role : "other";
    const extracted = extractText(message);
    const text = stripUiMetadata(extracted?.trim() ?? "");
    const thinking =
      role === "assistant" ? formatThinkingMarkdown(extractThinking(message) ?? "") : "";
    const toolLines = extractToolLines(message);
    if (!text && !thinking && toolLines.length === 0) continue;
    if (role === "system") {
      if (toolLines.length > 0) {
        lines.push(...toolLines);
      }
      continue;
    }
    if (role === "user") {
      if (text && isHeartbeatPrompt(text)) {
        inHeartbeatTurn = true;
        continue;
      }
      inHeartbeatTurn = false;
      if (text) {
        lines.push(`> ${text}`);
        lastUser = text;
      }
      lastRole = "user";
    } else if (inHeartbeatTurn) {
      // Skip assistant responses, tool calls, and everything else
      // that's part of a heartbeat turn — route to Activity panel only
      continue;
    } else if (role === "assistant") {
      const at = extractMessageTimestamp(message);
      if (typeof at === "number") {
        lastAssistantAt = at;
      }
      if (thinking) {
        lines.push(thinking);
      }
      if (toolLines.length > 0) {
        lines.push(...toolLines);
      }
      if (text) {
        lines.push(text);
        lastAssistant = text;
      }
      lastRole = "assistant";
    } else if (toolLines.length > 0) {
      lines.push(...toolLines);
    } else if (text) {
      lines.push(text);
    }
  }
  const deduped: string[] = [];
  for (const line of lines) {
    if (deduped[deduped.length - 1] === line) continue;
    deduped.push(line);
  }
  return { lines: deduped, lastAssistant, lastAssistantAt, lastRole, lastUser };
};

export const mergeHistoryWithPending = (
  historyLines: string[],
  currentLines: string[]
): string[] => {
  if (currentLines.length === 0) return historyLines;
  if (historyLines.length === 0) return historyLines;
  const merged = [...historyLines];
  let cursor = 0;
  for (const line of currentLines) {
    let foundIndex = -1;
    for (let i = cursor; i < merged.length; i += 1) {
      if (merged[i] === line) {
        foundIndex = i;
        break;
      }
    }
    if (foundIndex !== -1) {
      cursor = foundIndex + 1;
      continue;
    }
    merged.splice(cursor, 0, line);
    cursor += 1;
  }
  return merged;
};

export const buildHistorySyncPatch = ({
  messages,
  loadedAt,
  status,
  runId,
}: HistorySyncPatchInput): Partial<AgentState> => {
  const { lines, lastAssistant, lastAssistantAt, lastRole, lastUser } = buildHistoryLines(messages);
  if (lines.length === 0) return { historyLoadedAt: loadedAt };
  const messageParts = parseMessageParts({
    outputLines: lines,
    streamText: null,
    liveThinkingTrace: "",
  });

  // Inject image parts from user messages at the correct position
  // Images belong after user text parts, so we find the matching user text parts
  // and insert images right after them
  let insertIdx = messageParts.length;
  for (let mi = messages.length - 1; mi >= 0; mi--) {
    const message = messages[mi];
    if (!message) continue;
    const images = extractImages(message);
    if (images.length === 0) continue;
    const role = typeof message.role === "string" ? message.role : "";
    // Find the corresponding user text part in messageParts
    const msgText = extractText(message);
    if (role === "user" && msgText) {
      // Find last user text part that matches
      for (let pi = messageParts.length - 1; pi >= 0; pi--) {
        const p = messageParts[pi];
        if (p && p.type === "text" && p.text.trimStart().startsWith(">")) {
          insertIdx = pi + 1;
          break;
        }
      }
    }
    // Insert image parts at the found position
    for (const img of images) {
      messageParts.splice(insertIdx, 0, { type: "image", src: img.src, alt: img.alt });
      insertIdx++;
    }
  }
  const patch: Partial<AgentState> = {
    messageParts,
    lastResult: lastAssistant ?? null,
    ...(lastAssistant ? { latestPreview: lastAssistant } : {}),
    ...(typeof lastAssistantAt === "number" ? { lastAssistantMessageAt: lastAssistantAt } : {}),
    ...(lastUser ? { lastUserMessage: lastUser } : {}),
    historyLoadedAt: loadedAt,
  };
  if (!runId && status === "running" && lastRole === "assistant") {
    patch.status = "idle";
    patch.runId = null;
    patch.runStartedAt = null;
    patch.streamText = null;
    patch.thinkingTrace = null;
  }
  return patch;
};
