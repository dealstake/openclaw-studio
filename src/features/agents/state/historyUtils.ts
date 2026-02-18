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
  formatThinkingMarkdown,
  isHeartbeatPrompt,
  stripUiMetadata,
} from "@/lib/text/message-extract";
const toTimestampMs = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

const extractMessageTimestamp = (message: unknown): number | null => {
  if (!message || typeof message !== "object") return null;
  const record = message as Record<string, unknown>;
  return (
    toTimestampMs(record.timestamp) ?? toTimestampMs(record.createdAt) ?? toTimestampMs(record.at)
  );
};

export const buildHistoryLines = (messages: ChatHistoryMessage[]): HistoryLinesResult => {
  const lines: string[] = [];
  let lastAssistant: string | null = null;
  let lastAssistantAt: number | null = null;
  let lastRole: string | null = null;
  let lastUser: string | null = null;
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
      if (text && isHeartbeatPrompt(text)) continue;
      if (text) {
        lines.push(`> ${text}`);
        lastUser = text;
      }
      lastRole = "user";
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
  currentLines,
  loadedAt,
  status,
  runId,
}: HistorySyncPatchInput): Partial<AgentState> => {
  const { lines, lastAssistant, lastAssistantAt, lastRole, lastUser } = buildHistoryLines(messages);
  if (lines.length === 0) return { historyLoadedAt: loadedAt };
  const mergedLines = mergeHistoryWithPending(lines, currentLines);
  const isSame =
    mergedLines.length === currentLines.length &&
    mergedLines.every((line, index) => line === currentLines[index]);
  if (isSame) {
    const patch: Partial<AgentState> = { historyLoadedAt: loadedAt };
    if (typeof lastAssistantAt === "number") {
      patch.lastAssistantMessageAt = lastAssistantAt;
    }
    if (!runId && status === "running" && lastRole === "assistant") {
      patch.status = "idle";
      patch.runId = null;
      patch.streamText = null;
      patch.thinkingTrace = null;
    }
    return patch;
  }
  const patch: Partial<AgentState> = {
    outputLines: mergedLines,
    lastResult: lastAssistant ?? null,
    ...(lastAssistant ? { latestPreview: lastAssistant } : {}),
    ...(typeof lastAssistantAt === "number" ? { lastAssistantMessageAt: lastAssistantAt } : {}),
    ...(lastUser ? { lastUserMessage: lastUser } : {}),
    historyLoadedAt: loadedAt,
  };
  if (!runId && status === "running" && lastRole === "assistant") {
    patch.status = "idle";
    patch.runId = null;
    patch.streamText = null;
    patch.thinkingTrace = null;
  }
  return patch;
};
