import type { AgentState } from "@/features/agents/state/store";
import {
  getChatSummaryPatch,
  resolveAssistantCompletionTimestamp,
  type ChatEventPayload,
} from "@/features/agents/state/runtimeEventBridge";
import { isSameSessionKey } from "@/lib/gateway/GatewayClient";
import {
  extractText,
  extractThinking,
  isUiMetadataPrefix,
  stripUiMetadata,
} from "@/lib/text/message-extract";
import type { RuntimeTrackingState } from "./runtimeTrackingState";

const findAgentBySessionKey = (agents: AgentState[], sessionKey: string): string | null => {
  const exact = agents.find((agent) => isSameSessionKey(agent.sessionKey, sessionKey));
  return exact ? exact.agentId : null;
};

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
  if (!agentId && deps.onActivityEvent) {
    const isCron = payload.sessionKey.includes(":cron:");
    const isSubAgent = payload.sessionKey.includes(":subagent:");
    if (isCron || isSubAgent) {
      const text = extractText(payload.message);
      const snippet = text ? stripUiMetadata(text)?.slice(0, 120) ?? "" : "";
      deps.onActivityEvent(payload.sessionKey, {
        lastTextSnippet: snippet || undefined,
        streaming: payload.state === "delta",
        status: payload.state === "error" ? "error" : "running",
      });
    }
  }

  if (!agentId) return;
  const agent = agentsSnapshot.find((entry) => entry.agentId === agentId);

  // Route heartbeat messages to activity drawer instead of main chat
  if (payload.isHeartbeat && deps.onHeartbeatEvent) {
    if (payload.state === "delta") {
      state.markActivityThrottled(agentId);
      return;
    }
    if (payload.state === "final") {
      const text = extractText(payload.message) ?? "";
      const isOk = /HEARTBEAT_OK/i.test(text);
      deps.onHeartbeatEvent({
        runId: payload.runId,
        timestamp: state.now(),
        text,
        status: isOk ? "ok" : "alert",
      });
      state.clearRunTracking(payload.runId ?? null);
      deps.clearPendingLivePatch(agentId);
      deps.dispatch({
        type: "updateAgent",
        agentId,
        patch: { status: "idle", runId: null, streamText: null, thinkingTrace: null },
      });
      if (!isOk && typeof text === "string" && text.trim()) {
        deps.dispatch({
          type: "appendPart",
          agentId,
          part: { type: "text", text, streaming: false },
        });
      }
      return;
    }
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
