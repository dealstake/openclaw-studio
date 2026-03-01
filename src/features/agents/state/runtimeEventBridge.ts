/**
 * runtimeEventBridge.ts
 *
 * Core runtime event classification, lifecycle, and stream utilities.
 * Types, history utils, and summary utils are split into separate modules
 * and re-exported here for backward compatibility.
 */

// Re-export all types
export type {
  LifecyclePhase,
  LifecyclePatchInput,
  LifecycleTransition,
  ShouldPublishAssistantStreamInput,
  AssistantCompletionTimestampInput,
  DedupeRunLinesResult,
  ChatEventPayload,
  AgentEventPayload,
  SummarySnapshotAgent,
  SummarySessionStatusEntry,
  SummaryStatusSnapshot,
  SummaryPreviewItem,
  SummaryPreviewEntry,
  SummaryPreviewSnapshot,
  SummarySnapshotPatch,
  ChatHistoryMessage,
  HistoryLinesResult,
  HistorySyncPatchInput,
  GatewayEventKind,
} from "./runtimeEventBridge.types";

// Re-export history utils
export {
  buildHistoryLines,
  mergeHistoryWithPending,
  buildHistorySyncPatch,
} from "./historyUtils";

// Re-export summary utils
export {
  buildSummarySnapshotPatches,
  getChatSummaryPatch,
  getAgentSummaryPatch,
} from "./summaryUtils";

import type {
  LifecyclePatchInput,
  LifecycleTransition,
  ShouldPublishAssistantStreamInput,
  AssistantCompletionTimestampInput,
  DedupeRunLinesResult,
  GatewayEventKind,
} from "./runtimeEventBridge.types";

// ---------------------------------------------------------------------------
// Event classification
// ---------------------------------------------------------------------------

const REASONING_STREAM_NAME_HINTS = ["reason", "think", "analysis", "trace"];

export const classifyGatewayEventKind = (event: string): GatewayEventKind => {
  if (event === "presence" || event === "heartbeat") return "summary-refresh";
  if (event === "chat") return "runtime-chat";
  if (event === "agent") return "runtime-agent";
  if (event === "exec.approval.requested" || event === "exec.approval.resolved") return "exec-approval";
  if (event === "channels") return "channels-update";
  if (event === "sessions") return "sessions-update";
  if (event === "cron") return "cron-update";
  if (event === "nodes" || event === "node") return "nodes-update";
  if (event === "config") return "config-update";
  if (event === "openclaw:prompt-error" || event === "prompt-error") return "prompt-error";
  if (event === "log.line") return "log-stream";
  return "ignore";
};

export const isReasoningRuntimeAgentStream = (stream: string): boolean => {
  const normalized = stream.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "assistant" || normalized === "tool" || normalized === "lifecycle") {
    return false;
  }
  return REASONING_STREAM_NAME_HINTS.some((hint) => normalized.includes(hint));
};

// ---------------------------------------------------------------------------
// Stream merging & deduplication
// ---------------------------------------------------------------------------

export const mergeRuntimeStream = (current: string, incoming: string): string => {
  if (!incoming) return current;
  if (!current) return incoming;
  if (incoming.startsWith(current)) return incoming;
  if (current.startsWith(incoming)) return current;
  if (current.endsWith(incoming)) return current;
  if (incoming.endsWith(current)) return incoming;
  return `${current}${incoming}`;
};

export const dedupeRunLines = (seen: Set<string>, lines: string[]): DedupeRunLinesResult => {
  const nextSeen = new Set(seen);
  const appended: string[] = [];
  for (const line of lines) {
    if (!line || nextSeen.has(line)) continue;
    nextSeen.add(line);
    appended.push(line);
  }
  return { appended, nextSeen };
};

// ---------------------------------------------------------------------------
// Timestamp helpers (shared via timestampUtils.ts)
// ---------------------------------------------------------------------------

import { extractMessageTimestamp } from "./timestampUtils";

export const resolveAssistantCompletionTimestamp = ({
  role,
  state,
  message,
  now = Date.now(),
}: AssistantCompletionTimestampInput): number | null => {
  if (role !== "assistant" || state !== "final") return null;
  return extractMessageTimestamp(message) ?? now;
};

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

export const resolveLifecyclePatch = (input: LifecyclePatchInput): LifecycleTransition => {
  const { phase, incomingRunId, currentRunId, lastActivityAt } = input;
  if (phase === "start") {
    return {
      kind: "start",
      clearRunTracking: false,
      patch: {
        status: "running",
        runId: incomingRunId,
        runStartedAt: lastActivityAt,
        sessionCreated: true,
        lastActivityAt,
      },
    };
  }
  if (currentRunId && currentRunId !== incomingRunId) {
    return { kind: "ignore" };
  }
  if (phase === "error") {
    return {
      kind: "terminal",
      clearRunTracking: true,
      patch: {
        status: "error",
        runId: null,
        runStartedAt: null,
        streamText: null,
        thinkingTrace: null,
        lastActivityAt,
      },
    };
  }
  return {
    kind: "terminal",
    clearRunTracking: true,
    patch: {
      status: "idle",
      runId: null,
      runStartedAt: null,
      streamText: null,
      thinkingTrace: null,
      lastActivityAt,
    },
  };
};

// ---------------------------------------------------------------------------
// Stream publishing gate
// ---------------------------------------------------------------------------

export const shouldPublishAssistantStream = ({
  mergedRaw,
  rawText,
  hasChatEvents,
  currentStreamText,
}: ShouldPublishAssistantStreamInput): boolean => {
  if (!mergedRaw.trim()) return false;
  if (!hasChatEvents) return true;
  if (rawText.trim()) return true;
  return !currentStreamText?.trim();
};
