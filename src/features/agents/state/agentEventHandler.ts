import type { AgentState } from "@/features/agents/state/store";
import {
  getAgentSummaryPatch,
  isReasoningRuntimeAgentStream,
  mergeRuntimeStream,
  resolveLifecyclePatch,
  shouldPublishAssistantStream,
  type AgentEventPayload,
} from "@/features/agents/state/runtimeEventBridge";
import {
  extractText,
  extractThinking,
  extractThinkingFromTaggedStream,
  isUiMetadataPrefix,
  stripUiMetadata,
} from "@/lib/text/message-extract";
import { findAgentByRunId, findAgentBySessionKey } from "./agentLookup";
import type { RuntimeTrackingState } from "./runtimeTrackingState";

const extractReasoningBody = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^reasoning:\s*([\s\S]*)$/i);
  if (!match) return null;
  const body = (match[1] ?? "").trim();
  return body || null;
};

const resolveThinkingFromAgentStream = (
  data: Record<string, unknown> | null,
  rawStream: string,
  opts?: { treatPlainTextAsThinking?: boolean }
): string | null => {
  if (data) {
    const extracted = extractThinking(data);
    if (extracted) return extracted;
    const text = typeof data.text === "string" ? data.text : "";
    const delta = typeof data.delta === "string" ? data.delta : "";
    const prefixed = extractReasoningBody(text) ?? extractReasoningBody(delta);
    if (prefixed) return prefixed;
    if (opts?.treatPlainTextAsThinking) {
      const cleanedDelta = delta.trim();
      if (cleanedDelta) return cleanedDelta;
      const cleanedText = text.trim();
      if (cleanedText) return cleanedText;
    }
  }
  const tagged = extractThinkingFromTaggedStream(rawStream);
  return tagged || null;
};

export function handleRuntimeAgentEvent(
  payload: AgentEventPayload,
  state: RuntimeTrackingState
): void {
  if (!payload.runId) return;
  const deps = state.deps;
  const agentsSnapshot = deps.getAgents();
  const directMatch = payload.sessionKey ? findAgentBySessionKey(agentsSnapshot, payload.sessionKey) : null;
  const match = directMatch ?? findAgentByRunId(agentsSnapshot, payload.runId);

  if (!match) {
    // Sub-agent lifecycle events
    if (payload.stream === "lifecycle" && payload.sessionKey && /^agent:[^:]+:subagent:/.test(payload.sessionKey)) {
      const pData = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : null;
      const phase = typeof pData?.phase === "string" ? pData.phase : "";
      deps.onSubAgentLifecycle?.(payload.sessionKey, phase);
      deps.onSessionsUpdate?.();
    }
    // Route cron/subagent agent events to activity message store
    if (deps.onActivityMessage && payload.sessionKey) {
      const isCron = payload.sessionKey.includes(":cron:");
      const isSubAgent = payload.sessionKey.includes(":subagent:");
      if (isCron || isSubAgent) {
        const pData = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : null;
        const stream = typeof payload.stream === "string" ? payload.stream : "";
        if (stream === "tool") {
          const toolName = typeof pData?.name === "string" ? pData.name : "";
          const toolPhase = typeof pData?.phase === "string" ? pData.phase : "";
          if (toolName) {
            const toolCallId = typeof pData?.toolCallId === "string" ? pData.toolCallId : "";
            const args = pData?.arguments ?? pData?.args ?? pData?.input ?? null;
            const result = toolPhase === "result" ? pData?.result : undefined;
            const sourceType = isCron ? "cron" as const : "subagent" as const;
            deps.onActivityMessage(payload.sessionKey, {
              sourceName: "",
              sourceType,
              parts: [{
                type: "tool-invocation",
                toolCallId: toolCallId || `${payload.runId}-${toolName}`,
                name: toolName,
                phase: toolPhase === "result" ? "complete" : "running",
                args: args ? (typeof args === "string" ? args : JSON.stringify(args)) : undefined,
                result: result != null ? (typeof result === "string" ? result : JSON.stringify(result)) : undefined,
              }],
              status: "streaming",
            });
          }
        } else if (stream === "lifecycle") {
          const phase = typeof pData?.phase === "string" ? pData.phase : "";
          const sourceType = isCron ? "cron" as const : "subagent" as const;
          if (phase === "start") {
            deps.onActivityMessage(payload.sessionKey, {
              sourceName: "",
              sourceType,
              parts: [{ type: "status", state: "running" }],
              status: "streaming",
            });
          } else if (phase === "end") {
            deps.onActivityMessage(payload.sessionKey, {
              sourceName: "",
              sourceType,
              parts: [{ type: "status", state: "complete" }],
              status: "complete",
            });
          } else if (phase === "error") {
            deps.onActivityMessage(payload.sessionKey, {
              sourceName: "",
              sourceType,
              parts: [{ type: "status", state: "error" }],
              status: "error",
            });
          }
        }
      }
    }
    return;
  }

  const agent = agentsSnapshot.find((entry) => entry.agentId === match);
  if (!agent) return;

  // Suppress ALL agent events (tool invocations, lifecycle, etc.) while the
  // agent is in heartbeat mode. The chatEventHandler sets this flag when an
  // isHeartbeat delta arrives. Without this, tool invocation cards ("cron
  // Running...", "browser Running...") still appear in the main chat during
  // heartbeats even though the chat text is suppressed.
  if (state.heartbeatActiveAgents.has(match)) {
    return;
  }

  state.markActivityThrottled(match);
  const stream = typeof payload.stream === "string" ? payload.stream : "";
  const data =
    payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : null;
  const hasChatEvents = state.chatRunSeen.has(payload.runId);

  if (isReasoningRuntimeAgentStream(stream)) {
    const rawText = typeof data?.text === "string" ? (data.text as string) : "";
    const rawDelta = typeof data?.delta === "string" ? (data.delta as string) : "";
    const previousRaw = state.thinkingStreamByRun.get(payload.runId) ?? "";
    let mergedRaw = previousRaw;
    if (rawText) {
      mergedRaw = rawText;
    } else if (rawDelta) {
      mergedRaw = mergeRuntimeStream(previousRaw, rawDelta);
    }
    if (mergedRaw) {
      state.thinkingStreamByRun.set(payload.runId, mergedRaw);
    }
    const liveThinking =
      resolveThinkingFromAgentStream(data, mergedRaw, { treatPlainTextAsThinking: true }) ??
      (mergedRaw.trim() ? mergedRaw.trim() : null);
    if (liveThinking) {
      deps.queueLivePatch(match, {
        status: "running",
        runId: payload.runId,
        sessionCreated: true,
        lastActivityAt: state.now(),
        thinkingTrace: liveThinking,
      });
      const reasoningKey = state.getPartKey(match, payload.runId, "reasoning");
      state.appendOrUpdatePart(match, reasoningKey, {
        type: "reasoning",
        text: liveThinking,
        streaming: true,
        startedAt: state.partIndexByKey.has(reasoningKey) ? undefined : state.now(),
      });
    }
    return;
  }

  if (stream === "assistant") {
    const rawText = typeof data?.text === "string" ? data.text : "";
    const rawDelta = typeof data?.delta === "string" ? data.delta : "";
    const previousRaw = state.assistantStreamByRun.get(payload.runId) ?? "";
    let mergedRaw = previousRaw;
    if (rawText) {
      mergedRaw = rawText;
    } else if (rawDelta) {
      mergedRaw = mergeRuntimeStream(previousRaw, rawDelta);
    }
    if (mergedRaw) {
      state.assistantStreamByRun.set(payload.runId, mergedRaw);
    }
    const liveThinking = resolveThinkingFromAgentStream(data, mergedRaw);
    const patch: Partial<AgentState> = {
      status: "running",
      runId: payload.runId,
      lastActivityAt: state.now(),
      sessionCreated: true,
    };
    if (liveThinking) {
      patch.thinkingTrace = liveThinking;
    }
    if (mergedRaw && (!rawText || !isUiMetadataPrefix(rawText.trim()))) {
      const visibleText = extractText({ role: "assistant", content: mergedRaw }) ?? mergedRaw;
      const cleaned = stripUiMetadata(visibleText);
      if (
        cleaned &&
        shouldPublishAssistantStream({
          mergedRaw,
          rawText,
          hasChatEvents,
          currentStreamText: agent.streamText ?? null,
        })
      ) {
        patch.streamText = cleaned;
      }
    }
    deps.queueLivePatch(match, patch);
    if (patch.streamText) {
      const textKey = state.getPartKey(match, payload.runId, "text");
      state.appendOrUpdatePart(match, textKey, {
        type: "text",
        text: patch.streamText,
        streaming: true,
      });
    }
    if (liveThinking) {
      const reasoningKey = state.getPartKey(match, payload.runId, "reasoning");
      state.appendOrUpdatePart(match, reasoningKey, {
        type: "reasoning",
        text: liveThinking,
        streaming: true,
        startedAt: state.partIndexByKey.has(reasoningKey) ? undefined : state.now(),
      });
    }
    return;
  }

  if (stream === "tool") {
    const phase = typeof data?.phase === "string" ? data.phase : "";
    const name = typeof data?.name === "string" ? data.name : "tool";
    const toolCallId = typeof data?.toolCallId === "string" ? data.toolCallId : "";
    if (phase && phase !== "result") {
      const args =
        (data?.arguments as unknown) ??
        (data?.args as unknown) ??
        (data?.input as unknown) ??
        (data?.parameters as unknown) ??
        null;
      const toolKey = state.getPartKey(match, payload.runId, `tool:${toolCallId || name}`);
      const toolPhase = phase === "start" ? "pending" : "running";
      state.appendOrUpdatePart(match, toolKey, {
        type: "tool-invocation",
        toolCallId: toolCallId || `${payload.runId}-${name}`,
        name,
        phase: toolPhase,
        args: args ? (typeof args === "string" ? args : JSON.stringify(args)) : undefined,
        startedAt: state.partIndexByKey.has(toolKey) ? undefined : state.now(),
      });
      return;
    }
    if (phase !== "result") return;
    const result = data?.result;
    const isError = typeof data?.isError === "boolean" ? data.isError : undefined;
    const resultRecord =
      result && typeof result === "object" ? (result as Record<string, unknown>) : null;
    let content: unknown = result;
    if (resultRecord) {
      if (Array.isArray(resultRecord.content)) {
        content = resultRecord.content;
      } else if (typeof resultRecord.text === "string") {
        content = resultRecord.text;
      }
    }
    const toolResultKey = state.getPartKey(match, payload.runId, `tool:${toolCallId || name}`);
    const resultStr = typeof content === "string" ? content : JSON.stringify(content);
    state.appendOrUpdatePart(match, toolResultKey, {
      type: "tool-invocation",
      toolCallId: toolCallId || `${payload.runId}-${name}`,
      name,
      phase: isError ? "error" : "complete",
      result: resultStr,
      completedAt: state.now(),
    });
    return;
  }

  if (stream !== "lifecycle") return;
  const summaryPatch = getAgentSummaryPatch(payload, state.now());
  if (!summaryPatch) return;
  const phase = typeof data?.phase === "string" ? data.phase : "";
  if (phase !== "start" && phase !== "end" && phase !== "error") return;
  const transition = resolveLifecyclePatch({
    phase,
    incomingRunId: payload.runId,
    currentRunId: agent.runId,
    lastActivityAt: summaryPatch.lastActivityAt ?? state.now(),
  });
  if (transition.kind === "ignore") return;
  if (phase === "end" && !hasChatEvents) {
    const finalText = agent.streamText?.trim();
    if (finalText) {
      deps.dispatch({
        type: "updateAgent",
        agentId: match,
        patch: {
          lastResult: finalText,
          lastAssistantMessageAt: state.now(),
        },
      });
    }
  }
  // Finalize streaming messageParts on lifecycle end
  if (phase === "end" || phase === "error") {
    const currentAgent = deps.getAgents().find((a) => a.agentId === match);
    if (currentAgent) {
      currentAgent.messageParts.forEach((part, idx) => {
        if ((part.type === "text" || part.type === "reasoning") && part.streaming) {
          deps.dispatch({
            type: "updatePart",
            agentId: match,
            index: idx,
            patch: {
              streaming: false,
              ...(part.type === "reasoning" ? { completedAt: state.now() } : {}),
            },
          });
        }
      });
      const model = typeof data?.model === "string" ? data.model : undefined;
      deps.dispatch({
        type: "appendPart",
        agentId: match,
        part: {
          type: "status",
          state: phase === "end" ? "complete" : "error",
          model,
        },
      });
    }
  }
  if (transition.clearRunTracking) {
    state.clearRunTracking(payload.runId);
    deps.clearPendingLivePatch(match);
  }
  deps.dispatch({
    type: "updateAgent",
    agentId: match,
    patch: transition.patch,
  });
}
