import type { AgentState } from "@/features/agents/state/store";
import {
  getChatSummaryPatch,
  resolveAssistantCompletionTimestamp,
  type ChatEventPayload,
} from "@/features/agents/state/runtimeEventBridge";
import {
  extractText,
  extractThinking,
  extractImages,
  isUiMetadataPrefix,
  stripUiMetadata,
} from "@/lib/text/message-extract";
import { findAgentBySessionKey } from "./agentLookup";
import type { RuntimeTrackingState } from "./runtimeTrackingState";
import type { MessagePart } from "@/lib/chat/types";

// ── Constants ──────────────────────────────────────────────────────────

/** Shared patch to reset an agent back to idle after a run completes or errors. */
const IDLE_RESET_PATCH = {
  status: "idle" as const,
  runId: null,
  runStartedAt: null,
  streamText: null,
  thinkingTrace: null,
};

// ── Helpers ────────────────────────────────────────────────────────────

const resolveRole = (message: unknown) =>
  message && typeof message === "object"
    ? (message as Record<string, unknown>).role
    : null;

const summarizeThinkingMessage = (message: unknown) => {
  if (!message || typeof message !== "object") {
    return { type: typeof message };
  }
  const record = message as Record<string, unknown>;
  const summary: Record<string, unknown> = { keys: Object.keys(record) };
  const content = record.content;
  if (Array.isArray(content)) {
    summary.contentTypes = content.map((item) => {
      if (item && typeof item === "object") {
        const entry = item as Record<string, unknown>;
        return typeof entry.type === "string" ? entry.type : "object";
      }
      return typeof item;
    });
  } else if (typeof content === "string") {
    summary.contentLength = content.length;
  }
  if (typeof record.text === "string") {
    summary.textLength = record.text.length;
  }
  for (const key of ["analysis", "reasoning", "thinking"]) {
    const value = record[key];
    if (typeof value === "string") {
      summary[`${key}Length`] = value.length;
    } else if (value && typeof value === "object") {
      summary[`${key}Keys`] = Object.keys(value as Record<string, unknown>);
    }
  }
  return summary;
};

// ── Sub-handlers ───────────────────────────────────────────────────────

/**
 * Route cron/subagent chat events to the activity feed.
 * Returns true if the event was consumed (no further processing needed).
 */
function handleActivityFeedRouting(
  payload: ChatEventPayload,
  state: RuntimeTrackingState
): boolean {
  const isCron = payload.sessionKey!.includes(":cron:");
  const isSubAgent = payload.sessionKey!.includes(":subagent:");
  if (!isCron && !isSubAgent) return false;

  const deps = state.deps;
  const text = extractText(payload.message);
  if (deps.onActivityMessage) {
    const thinking = extractThinking(payload.message);
    const parts: MessagePart[] = [];
    if (thinking) {
      parts.push({ type: "reasoning", text: thinking, streaming: payload.state === "delta" });
    }
    const cleanedText = text ? stripUiMetadata(text) : null;
    if (cleanedText) {
      parts.push({ type: "text", text: cleanedText, streaming: payload.state === "delta" });
    }
    if (parts.length > 0) {
      const sourceType = isCron ? "cron" as const : "subagent" as const;
      const status = payload.state === "error" ? "error" as const
        : payload.state === "final" ? "complete" as const
        : "streaming" as const;
      deps.onActivityMessage(payload.sessionKey!, {
        sourceName: "",
        sourceType,
        parts,
        status,
      });
    }
  }
  return true; // consumed — no agent matched, so stop processing
}

/**
 * Handle heartbeat events. Returns true if the event was consumed.
 */
function handleHeartbeatEvent(
  payload: ChatEventPayload,
  agentId: string,
  state: RuntimeTrackingState
): boolean {
  if (!payload.isHeartbeat) return false;

  const deps = state.deps;

  if (payload.state === "delta") {
    state.heartbeatActiveAgents.add(agentId);
    state.markActivityThrottled(agentId);
    return true;
  }

  if (payload.state === "final") {
    state.heartbeatActiveAgents.delete(agentId);
    const text = extractText(payload.message) ?? "";
    const isOk = /HEARTBEAT_OK/i.test(text);
    state.clearRunTracking(payload.runId ?? null);
    deps.clearPendingLivePatch(agentId);
    deps.dispatch({
      type: "updateAgent",
      agentId,
      patch: IDLE_RESET_PATCH,
    });
    if (deps.onActivityMessage) {
      deps.onActivityMessage(`heartbeat-${payload.runId}`, {
        sourceName: "Heartbeat",
        sourceType: "heartbeat",
        parts: [{ type: "text", text, streaming: false }],
        status: isOk ? "complete" : "error",
      });
    }
    return true;
  }

  return false;
}

/**
 * Handle streaming delta events for an agent.
 */
function handleDeltaEvent(
  payload: ChatEventPayload,
  agentId: string,
  agent: AgentState | undefined,
  state: RuntimeTrackingState
): void {
  const deps = state.deps;
  const nextTextRaw = extractText(payload.message);
  const nextText = nextTextRaw ? stripUiMetadata(nextTextRaw) : null;
  const nextThinking = extractThinking(payload.message ?? payload);

  if (typeof nextTextRaw === "string" && isUiMetadataPrefix(nextTextRaw.trim())) {
    return;
  }

  const patch: Partial<AgentState> = {};
  if (nextThinking) {
    patch.thinkingTrace = nextThinking;
    patch.status = "running";
  }
  if (typeof nextText === "string") {
    patch.streamText = nextText;
    patch.status = "running";
  }
  if (patch.status === "running" && agent?.status !== "running") {
    patch.runStartedAt = state.now();
  }
  if (Object.keys(patch).length > 0) {
    deps.queueLivePatch(agentId, patch);
  }

  // Update messageParts for live streaming display
  if (typeof nextText === "string" && payload.runId) {
    const textKey = state.getPartKey(agentId, payload.runId, "text");
    state.appendOrUpdatePart(agentId, textKey, {
      type: "text",
      text: nextText,
      streaming: true,
    });
  }
  if (nextThinking && payload.runId) {
    const reasoningKey = state.getPartKey(agentId, payload.runId, "reasoning");
    state.appendOrUpdatePart(agentId, reasoningKey, {
      type: "reasoning",
      text: nextThinking,
      streaming: true,
      startedAt: state.partIndexByKey.has(reasoningKey) ? undefined : state.now(),
    });
  }
}

/**
 * Handle final (completed) events for an agent.
 */
function handleFinalEvent(
  payload: ChatEventPayload,
  agentId: string,
  agent: AgentState | undefined,
  role: unknown,
  state: RuntimeTrackingState
): void {
  const deps = state.deps;
  const nextTextRaw = extractText(payload.message);
  const nextText = nextTextRaw ? stripUiMetadata(nextTextRaw) : null;
  const nextThinking = extractThinking(payload.message ?? payload);
  const isToolRole = role === "tool" || role === "toolResult";

  if (!nextThinking && role === "assistant" && !state.thinkingDebugBySession.has(payload.sessionKey!)) {
    state.thinkingDebugBySession.add(payload.sessionKey!);
    state.logWarn("No thinking trace extracted from chat event.", {
      sessionKey: payload.sessionKey,
      message: summarizeThinkingMessage(payload.message ?? payload),
    });
  }

  const thinkingText = nextThinking ?? agent?.thinkingTrace ?? null;

  // Finalize streaming parts BEFORE clearing run tracking
  if (thinkingText && payload.runId) {
    const reasoningKey = state.getPartKey(agentId, payload.runId, "reasoning");
    state.appendOrUpdatePart(agentId, reasoningKey, {
      type: "reasoning",
      text: thinkingText,
      streaming: false,
      completedAt: state.now(),
    });
  } else if (thinkingText) {
    deps.dispatch({
      type: "appendPart",
      agentId,
      part: { type: "reasoning", text: thinkingText, streaming: false, completedAt: state.now() },
    });
  }

  if (!isToolRole && typeof nextText === "string") {
    if (payload.runId) {
      const textKey = state.getPartKey(agentId, payload.runId, "text");
      state.appendOrUpdatePart(agentId, textKey, {
        type: "text",
        text: nextText,
        streaming: false,
      });
    } else {
      deps.dispatch({
        type: "appendPart",
        agentId,
        part: { type: "text", text: nextText, streaming: false },
      });
    }
    deps.dispatch({
      type: "updateAgent",
      agentId,
      patch: { lastResult: nextText },
    });
  }

  state.clearRunTracking(payload.runId ?? null);
  deps.clearPendingLivePatch(agentId);

  // Dispatch image parts
  const images = extractImages(payload.message);
  for (const img of images) {
    deps.dispatch({
      type: "appendPart",
      agentId,
      part: { type: "image", src: img.src, alt: img.alt },
    });
  }

  if (agent?.lastUserMessage && !agent.latestOverride) {
    void deps.updateSpecialLatestUpdate(agentId, agent, agent.lastUserMessage);
  }

  const assistantCompletionAt = resolveAssistantCompletionTimestamp({
    role,
    state: payload.state,
    message: payload.message,
    now: state.now(),
  });
  deps.dispatch({
    type: "updateAgent",
    agentId,
    patch: {
      status: "idle",
      runId: null,
      runStartedAt: null,
      streamText: null,
      thinkingTrace: null,
      ...(typeof assistantCompletionAt === "number"
        ? { lastAssistantMessageAt: assistantCompletionAt }
        : {}),
    },
  });
}

/**
 * Handle aborted events for an agent.
 */
function handleAbortedEvent(
  payload: ChatEventPayload,
  agentId: string,
  state: RuntimeTrackingState
): void {
  const deps = state.deps;
  state.clearRunTracking(payload.runId ?? null);
  deps.clearPendingLivePatch(agentId);
  const reason = payload.errorMessage ?? "Run was aborted";
  deps.dispatch({
    type: "appendPart",
    agentId,
    part: {
      type: "status",
      state: "error",
      errorMessage: `⚠️ ${reason}`,
    } as MessagePart,
  });
  deps.dispatch({
    type: "updateAgent",
    agentId,
    patch: IDLE_RESET_PATCH,
  });
}

/**
 * Handle error events for an agent.
 */
function handleErrorEvent(
  payload: ChatEventPayload,
  agentId: string,
  state: RuntimeTrackingState
): void {
  const deps = state.deps;
  state.clearRunTracking(payload.runId ?? null);
  deps.clearPendingLivePatch(agentId);
  const errorText = payload.errorMessage ?? "An error occurred";
  deps.dispatch({
    type: "appendPart",
    agentId,
    part: {
      type: "status",
      state: "error",
      errorMessage: `❌ ${errorText}`,
    } as MessagePart,
  });
  deps.dispatch({
    type: "updateAgent",
    agentId,
    patch: { status: "error", runId: null, runStartedAt: null, streamText: null, thinkingTrace: null },
  });
}

// ── Main handler ───────────────────────────────────────────────────────

export function handleRuntimeChatEvent(
  payload: ChatEventPayload,
  state: RuntimeTrackingState
): void {
  if (!payload.sessionKey) return;

  if (payload.runId) {
    state.chatRunSeen.add(payload.runId);
  }

  const deps = state.deps;
  const agentsSnapshot = deps.getAgents();
  const agentId = findAgentBySessionKey(agentsSnapshot, payload.sessionKey);

  // Route cron/subagent events to activity feed
  if (!agentId) {
    handleActivityFeedRouting(payload, state);
    return;
  }

  const agent = agentsSnapshot.find((entry) => entry.agentId === agentId);

  // Handle heartbeat events
  if (handleHeartbeatEvent(payload, agentId, state)) return;

  // Suppress events while agent is in heartbeat mode
  if (state.heartbeatActiveAgents.has(agentId)) return;

  // Update chat summary
  const role = resolveRole(payload.message);
  const summaryPatch = getChatSummaryPatch(payload, state.now());
  if (summaryPatch) {
    deps.dispatch({
      type: "updateAgent",
      agentId,
      patch: { ...summaryPatch, sessionCreated: true },
    });
  }

  // Skip user/system messages
  if (role === "user" || role === "system") return;

  state.markActivityThrottled(agentId);

  // Dispatch to state-specific sub-handler
  switch (payload.state) {
    case "delta":
      handleDeltaEvent(payload, agentId, agent, state);
      break;
    case "final":
      handleFinalEvent(payload, agentId, agent, role, state);
      break;
    case "aborted":
      handleAbortedEvent(payload, agentId, state);
      break;
    case "error":
      handleErrorEvent(payload, agentId, state);
      break;
  }
}
