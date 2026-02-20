import type { AgentState } from "@/features/agents/state/store";
import {
  classifyGatewayEventKind,
  getAgentSummaryPatch,
  getChatSummaryPatch,
  isReasoningRuntimeAgentStream,
  mergeRuntimeStream,
  resolveLifecyclePatch,
  resolveAssistantCompletionTimestamp,
  shouldPublishAssistantStream,
  type AgentEventPayload,
  type ChatEventPayload,
} from "@/features/agents/state/runtimeEventBridge";
import { type EventFrame, isSameSessionKey } from "@/lib/gateway/GatewayClient";
import {
  extractText,
  extractThinking,
  extractThinkingFromTaggedStream,
  isUiMetadataPrefix,
  stripUiMetadata,
} from "@/lib/text/message-extract";
// NOTE: formatToolCallMarkdown, formatThinkingMarkdown, isTraceMarkdown, extractToolLines
// removed — no longer needed now that appendOutput/outputLines are eliminated from live events.

import type { MessagePart } from "@/lib/chat/types";

type RuntimeDispatchAction =
  | { type: "updateAgent"; agentId: string; patch: Partial<AgentState> }
  | { type: "appendPart"; agentId: string; part: MessagePart }
  | { type: "updatePart"; agentId: string; index: number; patch: Partial<MessagePart> }
  | { type: "markActivity"; agentId: string; at?: number };

export type GatewayRuntimeEventHandlerDeps = {
  getStatus: () => "disconnected" | "connecting" | "connected";
  getAgents: () => AgentState[];
  dispatch: (action: RuntimeDispatchAction) => void;
  queueLivePatch: (agentId: string, patch: Partial<AgentState>) => void;
  clearPendingLivePatch: (agentId: string) => void;
  now?: () => number;

  loadSummarySnapshot: () => Promise<void>;
  loadAgentHistory: (agentId: string) => Promise<void>;
  refreshHeartbeatLatestUpdate: () => void;
  bumpHeartbeatTick: () => void;

  setTimeout: (fn: () => void, delayMs: number) => number;
  clearTimeout: (id: number) => void;

  isDisconnectLikeError: (err: unknown) => boolean;
  logWarn?: (message: string, meta?: unknown) => void;

  updateSpecialLatestUpdate: (agentId: string, agent: AgentState, message: string) => void;

  onExecApprovalRequested?: (payload: unknown) => void;
  onExecApprovalResolved?: (payload: unknown) => void;
  onChannelsUpdate?: () => void;
  onSessionsUpdate?: () => void;
  onCronUpdate?: () => void;
  onSubAgentLifecycle?: (sessionKey: string, phase: string) => void;
  onActivityEvent?: (sessionKey: string, data: {
    lastAction?: string;
    lastToolName?: string;
    lastTextSnippet?: string;
    streaming?: boolean;
    status?: "running" | "completed" | "error";
    agentId?: string;
    taskName?: string;
  }) => void;
  onSystemEvent?: (event: {
    kind: "exec-approval" | "session-lifecycle" | "cron-schedule";
    title: string;
    subtitle: string;
  }) => void;
};

export type GatewayRuntimeEventHandler = {
  handleEvent: (event: EventFrame) => void;
  clearRunTracking: (runId?: string | null) => void;
  dispose: () => void;
};

const extractExecCommandSummary = (payload: unknown): string => {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  const cmd = typeof p.command === "string" ? p.command : "";
  return cmd.length > 80 ? cmd.slice(0, 77) + "…" : cmd;
};

const findAgentBySessionKey = (agents: AgentState[], sessionKey: string): string | null => {
  const exact = agents.find((agent) => isSameSessionKey(agent.sessionKey, sessionKey));
  return exact ? exact.agentId : null;
};

const findAgentByRunId = (agents: AgentState[], runId: string): string | null => {
  const match = agents.find((agent) => agent.runId === runId);
  return match ? match.agentId : null;
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

export function createGatewayRuntimeEventHandler(
  deps: GatewayRuntimeEventHandlerDeps
): GatewayRuntimeEventHandler {
  const now = deps.now ?? (() => Date.now());
  const chatRunSeen = new Set<string>();
  const assistantStreamByRun = new Map<string, string>();
  const thinkingStreamByRun = new Map<string, string>();
  const thinkingDebugBySession = new Set<string>();
  const lastActivityMarkByAgent = new Map<string, number>();

  // MessagePart tracking: map run+type to the index in agent.messageParts[]
  // so we can update streaming parts in-place via updatePart dispatch.
  // Key format: "{agentId}:{runId}:{partType}" or "{agentId}:{runId}:tool:{toolCallId}"
  const partIndexByKey = new Map<string, number>();

  const getPartKey = (agentId: string, runId: string, suffix: string) =>
    `${agentId}:${runId}:${suffix}`;

  const appendOrUpdatePart = (agentId: string, key: string, part: MessagePart): void => {
    const existingIndex = partIndexByKey.get(key);
    if (existingIndex !== undefined) {
      deps.dispatch({ type: "updatePart", agentId, index: existingIndex, patch: part });
    } else {
      const agent = deps.getAgents().find((a) => a.agentId === agentId);
      const nextIndex = agent ? agent.messageParts.length : 0;
      partIndexByKey.set(key, nextIndex);
      deps.dispatch({ type: "appendPart", agentId, part });
    }
  };

  let summaryRefreshTimer: number | null = null;
  let sessionsRefreshTimer: number | null = null;
  let cronRefreshTimer: number | null = null;

  const clearRunTracking = (runId?: string | null) => {
    if (!runId) return;
    chatRunSeen.delete(runId);
    assistantStreamByRun.delete(runId);
    thinkingStreamByRun.delete(runId);
    // Clean up part index entries for this run
    for (const key of partIndexByKey.keys()) {
      if (key.includes(`:${runId}:`)) {
        partIndexByKey.delete(key);
      }
    }
  };

  const markActivityThrottled = (agentId: string, at: number = now()) => {
    const lastAt = lastActivityMarkByAgent.get(agentId) ?? 0;
    if (at - lastAt < 300) return;
    lastActivityMarkByAgent.set(agentId, at);
    deps.dispatch({ type: "markActivity", agentId, at });
  };

  const logWarn =
    deps.logWarn ??
    ((message: string, meta?: unknown) => {
      console.warn(message, meta);
    });

  const dispose = () => {
    if (summaryRefreshTimer !== null) {
      deps.clearTimeout(summaryRefreshTimer);
      summaryRefreshTimer = null;
    }
    if (sessionsRefreshTimer !== null) {
      deps.clearTimeout(sessionsRefreshTimer);
      sessionsRefreshTimer = null;
    }
    if (cronRefreshTimer !== null) {
      deps.clearTimeout(cronRefreshTimer);
      cronRefreshTimer = null;
    }
    chatRunSeen.clear();
    assistantStreamByRun.clear();
    thinkingStreamByRun.clear();
    thinkingDebugBySession.clear();
    lastActivityMarkByAgent.clear();
    partIndexByKey.clear();
  };

  const handleRuntimeChatEvent = (payload: ChatEventPayload) => {
    if (!payload.sessionKey) return;

    if (payload.runId) {
      chatRunSeen.add(payload.runId);
    }

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

    const role = resolveRole(payload.message);
    const summaryPatch = getChatSummaryPatch(payload, now());
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

    markActivityThrottled(agentId);

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
      clearRunTracking(payload.runId ?? null);
      // Clear any pending rAF-batched live patches so stale "running" status
      // from streaming frames cannot overwrite the idle transition below.
      deps.clearPendingLivePatch(agentId);
      if (!nextThinking && role === "assistant" && !thinkingDebugBySession.has(payload.sessionKey)) {
        thinkingDebugBySession.add(payload.sessionKey);
        logWarn("No thinking trace extracted from chat event.", {
          sessionKey: payload.sessionKey,
          message: summarizeThinkingMessage(payload.message ?? payload),
        });
      }
      const thinkingText = nextThinking ?? agent?.thinkingTrace ?? null;
      // If no thinking was extracted for this turn and none exists in messageParts,
      // reload history to try to recover it from the server.
      if (
        !thinkingText &&
        role === "assistant" &&
        agent &&
        !agent.messageParts.some((p) => p.type === "reasoning")
      ) {
        void deps.loadAgentHistory(agentId);
      }
      // Populate messageParts from chat final event
      if (thinkingText) {
        deps.dispatch({
          type: "appendPart",
          agentId,
          part: { type: "reasoning", text: thinkingText, streaming: false, completedAt: now() },
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
        now: now(),
      });
      deps.dispatch({
        type: "updateAgent",
        agentId,
        patch: {
          // The gateway only emits chat "final" when the run lifecycle ends,
          // so this is a safe place to transition status to idle as a backup
          // in case the agent lifecycle event races or is missed.
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
      clearRunTracking(payload.runId ?? null);
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
      clearRunTracking(payload.runId ?? null);
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
  };

  const handleRuntimeAgentEvent = (payload: AgentEventPayload) => {
    if (!payload.runId) return;
    const agentsSnapshot = deps.getAgents();
    const directMatch = payload.sessionKey ? findAgentBySessionKey(agentsSnapshot, payload.sessionKey) : null;
    const match = directMatch ?? findAgentByRunId(agentsSnapshot, payload.runId);
    if (!match) {
      // Sub-agent lifecycle events: refresh sessions so Fleet sidebar updates Running/Done
      if (payload.stream === "lifecycle" && payload.sessionKey && /^agent:[^:]+:subagent:/.test(payload.sessionKey)) {
        const pData = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : null;
        const phase = typeof pData?.phase === "string" ? pData.phase : "";
        deps.onSubAgentLifecycle?.(payload.sessionKey, phase);
        deps.onSessionsUpdate?.();
      }
      // Route cron/subagent agent events to activity feed
      if (deps.onActivityEvent && payload.sessionKey) {
        const isCron = payload.sessionKey.includes(":cron:");
        const isSubAgent = payload.sessionKey.includes(":subagent:");
        if (isCron || isSubAgent) {
          const pData = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : null;
          const stream = typeof payload.stream === "string" ? payload.stream : "";
          if (stream === "tool") {
            const toolName = typeof pData?.name === "string" ? pData.name : "";
            const toolPhase = typeof pData?.phase === "string" ? pData.phase : "";
            if (toolName) {
              deps.onActivityEvent(payload.sessionKey, {
                lastToolName: toolName,
                lastAction: `${toolName}${toolPhase === "result" ? " ✓" : "…"}`,
              });
            }
          } else if (stream === "lifecycle") {
            const phase = typeof pData?.phase === "string" ? pData.phase : "";
            if (phase === "start") {
              deps.onActivityEvent(payload.sessionKey, { status: "running" });
            } else if (phase === "end") {
              deps.onActivityEvent(payload.sessionKey, { status: "completed", streaming: false });
            } else if (phase === "error") {
              deps.onActivityEvent(payload.sessionKey, { status: "error", streaming: false });
            }
          }
        }
      }
      return;
    }
    const agent = agentsSnapshot.find((entry) => entry.agentId === match);
    if (!agent) return;

    markActivityThrottled(match);
    const stream = typeof payload.stream === "string" ? payload.stream : "";
    const data =
      payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : null;
    const hasChatEvents = chatRunSeen.has(payload.runId);

    if (isReasoningRuntimeAgentStream(stream)) {
      const rawText = typeof data?.text === "string" ? (data.text as string) : "";
      const rawDelta = typeof data?.delta === "string" ? (data.delta as string) : "";
      const previousRaw = thinkingStreamByRun.get(payload.runId) ?? "";
      let mergedRaw = previousRaw;
      if (rawText) {
        mergedRaw = rawText;
      } else if (rawDelta) {
        mergedRaw = mergeRuntimeStream(previousRaw, rawDelta);
      }
      if (mergedRaw) {
        thinkingStreamByRun.set(payload.runId, mergedRaw);
      }
      const liveThinking =
        resolveThinkingFromAgentStream(data, mergedRaw, { treatPlainTextAsThinking: true }) ??
        (mergedRaw.trim() ? mergedRaw.trim() : null);
      if (liveThinking) {
        deps.queueLivePatch(match, {
          status: "running",
          runId: payload.runId,
          sessionCreated: true,
          lastActivityAt: now(),
          thinkingTrace: liveThinking,
        });
        // Populate messageParts with streaming reasoning
        const reasoningKey = getPartKey(match, payload.runId, "reasoning");
        appendOrUpdatePart(match, reasoningKey, {
          type: "reasoning",
          text: liveThinking,
          streaming: true,
          startedAt: partIndexByKey.has(reasoningKey) ? undefined : now(),
        });
      }
      return;
    }

    if (stream === "assistant") {
      const rawText = typeof data?.text === "string" ? data.text : "";
      const rawDelta = typeof data?.delta === "string" ? data.delta : "";
      const previousRaw = assistantStreamByRun.get(payload.runId) ?? "";
      let mergedRaw = previousRaw;
      if (rawText) {
        mergedRaw = rawText;
      } else if (rawDelta) {
        mergedRaw = mergeRuntimeStream(previousRaw, rawDelta);
      }
      if (mergedRaw) {
        assistantStreamByRun.set(payload.runId, mergedRaw);
      }
      const liveThinking = resolveThinkingFromAgentStream(data, mergedRaw);
      const patch: Partial<AgentState> = {
        status: "running",
        runId: payload.runId,
        lastActivityAt: now(),
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
      // Populate messageParts with streaming text
      if (patch.streamText) {
        const textKey = getPartKey(match, payload.runId, "text");
        appendOrUpdatePart(match, textKey, {
          type: "text",
          text: patch.streamText,
          streaming: true,
        });
      }
      // Populate messageParts with streaming reasoning from assistant stream
      if (liveThinking) {
        const reasoningKey = getPartKey(match, payload.runId, "reasoning");
        appendOrUpdatePart(match, reasoningKey, {
          type: "reasoning",
          text: liveThinking,
          streaming: true,
          startedAt: partIndexByKey.has(reasoningKey) ? undefined : now(),
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
        // Populate messageParts with tool invocation
        const toolKey = getPartKey(match, payload.runId, `tool:${toolCallId || name}`);
        const toolPhase = phase === "start" ? "pending" : "running";
        appendOrUpdatePart(match, toolKey, {
          type: "tool-invocation",
          toolCallId: toolCallId || `${payload.runId}-${name}`,
          name,
          phase: toolPhase,
          args: args ? (typeof args === "string" ? args : JSON.stringify(args)) : undefined,
          startedAt: partIndexByKey.has(toolKey) ? undefined : now(),
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
      // Update messageParts tool invocation to complete
      const toolResultKey = getPartKey(match, payload.runId, `tool:${toolCallId || name}`);
      const resultStr = typeof content === "string" ? content : JSON.stringify(content);
      appendOrUpdatePart(match, toolResultKey, {
        type: "tool-invocation",
        toolCallId: toolCallId || `${payload.runId}-${name}`,
        name,
        phase: isError ? "error" : "complete",
        result: resultStr,
        completedAt: now(),
      });
      return;
    }

    if (stream !== "lifecycle") return;
    const summaryPatch = getAgentSummaryPatch(payload, now());
    if (!summaryPatch) return;
    const phase = typeof data?.phase === "string" ? data.phase : "";
    if (phase !== "start" && phase !== "end" && phase !== "error") return;
    const transition = resolveLifecyclePatch({
      phase,
      incomingRunId: payload.runId,
      currentRunId: agent.runId,
      lastActivityAt: summaryPatch.lastActivityAt ?? now(),
    });
    if (transition.kind === "ignore") return;
    if (phase === "end" && !hasChatEvents) {
      const finalText = agent.streamText?.trim();
      if (finalText) {
        const assistantCompletionAt = now();
        deps.dispatch({
          type: "updateAgent",
          agentId: match,
          patch: {
            lastResult: finalText,
            lastAssistantMessageAt: assistantCompletionAt,
          },
        });
      }
    }
    // Finalize streaming messageParts on lifecycle end
    if (phase === "end" || phase === "error") {
      const currentAgent = deps.getAgents().find((a) => a.agentId === match);
      if (currentAgent) {
        // Mark all streaming text/reasoning parts as complete
        currentAgent.messageParts.forEach((part, idx) => {
          if ((part.type === "text" || part.type === "reasoning") && part.streaming) {
            deps.dispatch({
              type: "updatePart",
              agentId: match,
              index: idx,
              patch: {
                streaming: false,
                ...(part.type === "reasoning" ? { completedAt: now() } : {}),
              },
            });
          }
        });
        // Append a status part
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
      clearRunTracking(payload.runId);
      // Flush any pending rAF-batched live patches for this agent so that a
      // stale `status: "running"` queued from a prior streaming frame cannot
      // overwrite the terminal `status: "idle"` dispatched below.
      deps.clearPendingLivePatch(match);
    }
    deps.dispatch({
      type: "updateAgent",
      agentId: match,
      patch: transition.patch,
    });
  };

  const handleEvent = (event: EventFrame) => {
    const eventKind = classifyGatewayEventKind(event.event);
    if (eventKind === "summary-refresh") {
      if (deps.getStatus() !== "connected") return;
      if (event.event === "heartbeat") {
        deps.bumpHeartbeatTick();
        deps.refreshHeartbeatLatestUpdate();
      }
      if (summaryRefreshTimer !== null) {
        deps.clearTimeout(summaryRefreshTimer);
      }
      summaryRefreshTimer = deps.setTimeout(() => {
        summaryRefreshTimer = null;
        void deps.loadSummarySnapshot();
      }, 750);
      return;
    }
    if (eventKind === "runtime-chat") {
      const payload = event.payload as ChatEventPayload | undefined;
      if (!payload) return;
      handleRuntimeChatEvent(payload);
      return;
    }
    if (eventKind === "runtime-agent") {
      const payload = event.payload as AgentEventPayload | undefined;
      if (!payload) return;
      handleRuntimeAgentEvent(payload);
      return;
    }
    if (eventKind === "exec-approval") {
      if (event.event === "exec.approval.requested") {
        deps.onExecApprovalRequested?.(event.payload);
        deps.onSystemEvent?.({
          kind: "exec-approval",
          title: "Exec approval requested",
          subtitle: extractExecCommandSummary(event.payload),
        });
      } else if (event.event === "exec.approval.resolved") {
        deps.onExecApprovalResolved?.(event.payload);
        deps.onSystemEvent?.({
          kind: "exec-approval",
          title: "Exec approval resolved",
          subtitle: "",
        });
      }
      return;
    }
    if (eventKind === "channels-update") {
      deps.onChannelsUpdate?.();
      return;
    }
    if (eventKind === "sessions-update") {
      deps.onSystemEvent?.({
        kind: "session-lifecycle",
        title: "Session updated",
        subtitle: "",
      });
      if (sessionsRefreshTimer !== null) deps.clearTimeout(sessionsRefreshTimer);
      sessionsRefreshTimer = deps.setTimeout(() => {
        sessionsRefreshTimer = null;
        deps.onSessionsUpdate?.();
      }, 750);
      return;
    }
    if (eventKind === "cron-update") {
      deps.onSystemEvent?.({
        kind: "cron-schedule",
        title: "Cron schedule updated",
        subtitle: "",
      });
      if (cronRefreshTimer !== null) deps.clearTimeout(cronRefreshTimer);
      cronRefreshTimer = deps.setTimeout(() => {
        cronRefreshTimer = null;
        deps.onCronUpdate?.();
      }, 750);
      return;
    }
  };

  return { handleEvent, clearRunTracking, dispose };
}
