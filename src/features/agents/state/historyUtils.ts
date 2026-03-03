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

  // Build a Set for O(1) existence checks (fast path for common case)
  const historySet = new Set(historyLines);
  const merged = [...historyLines];
  let cursor = 0;
  // Track insertion offset: as we splice items in, original indices shift
  let _offset = 0;

  for (const line of currentLines) {
    // Fast path: line doesn't exist in history at all
    if (!historySet.has(line)) {
      merged.splice(cursor, 0, line);
      _offset += 1;
      cursor += 1;
      continue;
    }
    // Line exists — scan forward from cursor to find it
    let foundIndex = -1;
    for (let i = cursor; i < merged.length; i++) {
      if (merged[i] === line) {
        foundIndex = i;
        break;
      }
    }
    if (foundIndex !== -1) {
      cursor = foundIndex + 1;
    } else {
      // Line exists in history but before cursor — insert at cursor
      merged.splice(cursor, 0, line);
      cursor += 1;
    }
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

  // Inject image parts from user messages at the correct position.
  // Images belong after the user text part that matches their source message.
  // We match by comparing the stripped message text to the quoted line content.
  for (let mi = messages.length - 1; mi >= 0; mi--) {
    const message = messages[mi];
    if (!message) continue;
    const images = extractImages(message);
    if (images.length === 0) continue;
    const role = typeof message.role === "string" ? message.role : "";
    if (role !== "user") continue;
    const msgText = stripUiMetadata(extractText(message)?.trim() ?? "");
    if (!msgText) continue;

    // Find the exact matching quoted user text part: "> <msgText>"
    let insertIdx = messageParts.length; // fallback: append at end
    for (let pi = messageParts.length - 1; pi >= 0; pi--) {
      const p = messageParts[pi];
      if (p && p.type === "text") {
        const quoted = p.text.trimStart();
        if (quoted.startsWith("> ") && quoted.slice(2).trim() === msgText) {
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
