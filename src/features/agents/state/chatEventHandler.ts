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

  // Route cron/subagent chat events to activity feed
  if (!agentId) {
    const isCron = payload.sessionKey.includes(":cron:");
    const isSubAgent = payload.sessionKey.includes(":subagent:");
    if (isCron || isSubAgent) {
      const text = extractText(payload.message);
      // Full message content to activity message store
      if (deps.onActivityMessage) {
        const thinking = extractThinking(payload.message);
        const parts: import("@/lib/chat/types").MessagePart[] = [];
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
          deps.onActivityMessage(payload.sessionKey, {
            sourceName: "",
            sourceType,
            parts,
            status,
          });
        }
      }
    }
  }

  if (!agentId) return;
  const agent = agentsSnapshot.find((entry) => entry.agentId === agentId);

  // Route heartbeat messages to activity store only — no main chat pollution.
  // Track heartbeat mode so tool call events (which lack isHeartbeat flag)
  // are also suppressed during the heartbeat turn.
  if (payload.isHeartbeat) {
    if (payload.state === "delta") {
      state.heartbeatActiveAgents.add(agentId);
      state.markActivityThrottled(agentId);
      return;
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
        patch: { status: "idle", runId: null, streamText: null, thinkingTrace: null },
      });
      if (deps.onActivityMessage) {
        deps.onActivityMessage(`heartbeat-${payload.runId}`, {
          sourceName: "Heartbeat",
          sourceType: "heartbeat",
          parts: [{ type: "text", text, streaming: false }],
          status: isOk ? "complete" : "error",
        });
      }
      return;
    }
  }

  // Suppress ALL events (tool calls, etc.) while an agent is in heartbeat mode.
  // Tool call events during heartbeats don't carry isHeartbeat, so we rely on
  // the tracked mode set above when an isHeartbeat delta was received.
  if (state.heartbeatActiveAgents.has(agentId)) {
    return;
  }

  const role = resolveRole(payload.message);
  const summaryPatch = getChatSummaryPatch(payload, state.now());
  if (summaryPatch) {
    deps.dispatch({
      type: "updateAgent",
      agentId,
      patch: {
        ...summaryPatch,
        sessionCreated: true,
      },
    });
  }

  if (role === "user" || role === "system") {
    return;
  }

  state.markActivityThrottled(agentId);

  const nextTextRaw = extractText(payload.message);
  const nextText = nextTextRaw ? stripUiMetadata(nextTextRaw) : null;
  const nextThinking = extractThinking(payload.message ?? payload);
  const isToolRole = role === "tool" || role === "toolResult";

  if (payload.state === "delta") {
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
    if (Object.keys(patch).length > 0) {
      deps.queueLivePatch(agentId, patch);
    }
    return;
  }

  if (payload.state === "final") {
    state.clearRunTracking(payload.runId ?? null);
    deps.clearPendingLivePatch(agentId);
    if (!nextThinking && role === "assistant" && !state.thinkingDebugBySession.has(payload.sessionKey)) {
      state.thinkingDebugBySession.add(payload.sessionKey);
      state.logWarn("No thinking trace extracted from chat event.", {
        sessionKey: payload.sessionKey,
        message: summarizeThinkingMessage(payload.message ?? payload),
      });
    }
    const thinkingText = nextThinking ?? agent?.thinkingTrace ?? null;
    if (
      !thinkingText &&
      role === "assistant" &&
      agent &&
      !agent.messageParts.some((p) => p.type === "reasoning")
    ) {
      void deps.loadAgentHistory(agentId);
    }
    if (thinkingText) {
      deps.dispatch({
        type: "appendPart",
        agentId,
        part: { type: "reasoning", text: thinkingText, streaming: false, completedAt: state.now() },
      });
    }
    if (!isToolRole && typeof nextText === "string") {
      deps.dispatch({
        type: "appendPart",
        agentId,
        part: { type: "text", text: nextText, streaming: false },
      });
      deps.dispatch({
        type: "updateAgent",
        agentId,
        patch: { lastResult: nextText },
      });
    }
    // Dispatch image parts from messages containing image content
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
        streamText: null,
        thinkingTrace: null,
        ...(typeof assistantCompletionAt === "number"
          ? { lastAssistantMessageAt: assistantCompletionAt }
          : {}),
      },
    });
    return;
  }

  if (payload.state === "aborted") {
    state.clearRunTracking(payload.runId ?? null);
    deps.clearPendingLivePatch(agentId);
    deps.dispatch({
      type: "appendPart",
      agentId,
      part: { type: "text", text: "Run aborted.", streaming: false },
    });
    deps.dispatch({
      type: "updateAgent",
      agentId,
      patch: { status: "idle", runId: null, streamText: null, thinkingTrace: null },
    });
    return;
  }

  if (payload.state === "error") {
    state.clearRunTracking(payload.runId ?? null);
    deps.clearPendingLivePatch(agentId);
    deps.dispatch({
      type: "appendPart",
      agentId,
      part: { type: "text", text: payload.errorMessage ? `Error: ${payload.errorMessage}` : "Run error.", streaming: false },
    });
    deps.dispatch({
      type: "updateAgent",
      agentId,
      patch: { status: "error", runId: null, streamText: null, thinkingTrace: null },
    });
  }
}
