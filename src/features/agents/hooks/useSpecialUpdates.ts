import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentState } from "../state/store";
import {
  type CronJobSummary,
  formatCronJobDisplay,
  listCronJobs,
  resolveLatestCronJobForAgent,
} from "@/lib/cron/types";
import {
  type GatewayClient,
  isGatewayDisconnectLikeError,
  parseAgentIdFromSessionKey,
} from "@/lib/gateway/GatewayClient";
import { extractText, isHeartbeatPrompt, stripUiMetadata } from "@/lib/text/message-extract";

type ChatHistoryMessage = Record<string, unknown>;
type ChatHistoryResult = {
  sessionKey: string;
  sessionId?: string;
  messages: ChatHistoryMessage[];
  thinkingLevel?: string;
};
type SessionsListEntry = {
  key: string;
  updatedAt?: number | null;
  displayName?: string;
  origin?: { label?: string | null; provider?: string | null } | null;
  thinkingLevel?: string;
  modelProvider?: string;
  model?: string;
};
type SessionsListResult = {
  sessions?: SessionsListEntry[];
};

const SPECIAL_UPDATE_HEARTBEAT_RE = /\bheartbeat\b/i;
const SPECIAL_UPDATE_CRON_RE = /\bcron\b/i;

export const resolveSpecialUpdateKind = (message: string) => {
  const lowered = message.toLowerCase();
  const heartbeatIndex = lowered.search(SPECIAL_UPDATE_HEARTBEAT_RE);
  const cronIndex = lowered.search(SPECIAL_UPDATE_CRON_RE);
  if (heartbeatIndex === -1 && cronIndex === -1) return null;
  if (heartbeatIndex === -1) return "cron";
  if (cronIndex === -1) return "heartbeat";
  return cronIndex > heartbeatIndex ? "cron" : "heartbeat";
};

const findLatestHeartbeatResponse = (messages: ChatHistoryMessage[]) => {
  let awaitingHeartbeatReply = false;
  let latestResponse: string | null = null;
  for (const message of messages) {
    const role = typeof message.role === "string" ? message.role : "";
    if (role === "user") {
      const text = stripUiMetadata(extractText(message) ?? "").trim();
      awaitingHeartbeatReply = isHeartbeatPrompt(text);
      continue;
    }
    if (role === "assistant" && awaitingHeartbeatReply) {
      const text = stripUiMetadata(extractText(message) ?? "").trim();
      if (text) {
        latestResponse = text;
      }
    }
  }
  return latestResponse;
};

type Dispatch = (action: { type: "updateAgent"; agentId: string; patch: Partial<AgentState> }) => void;

export function useSpecialUpdates(params: {
  client: GatewayClient;
  dispatch: Dispatch;
  agents: AgentState[];
  stateRef: React.RefObject<{ agents: AgentState[] }>;
}) {
  const { client, dispatch, agents, stateRef } = params;
  const specialUpdateRef = useRef<Map<string, string>>(new Map());
  const specialUpdateInFlightRef = useRef<Set<string>>(new Set());
  const [heartbeatTick, setHeartbeatTick] = useState(0);

  const resolveCronJobForAgent = useCallback((jobs: CronJobSummary[], agent: AgentState) => {
    return resolveLatestCronJobForAgent(jobs, agent.agentId);
  }, []);

  const updateSpecialLatestUpdate = useCallback(
    async (agentId: string, agent: AgentState, message: string) => {
      const key = agentId;
      const kind = resolveSpecialUpdateKind(message);
      if (!kind) {
        if (agent.latestOverride || agent.latestOverrideKind) {
          dispatch({
            type: "updateAgent",
            agentId: agent.agentId,
            patch: { latestOverride: null, latestOverrideKind: null },
          });
        }
        return;
      }
      if (specialUpdateInFlightRef.current.has(key)) return;
      specialUpdateInFlightRef.current.add(key);
      try {
        if (kind === "heartbeat") {
          const resolvedId =
            agent.agentId?.trim() || parseAgentIdFromSessionKey(agent.sessionKey);
          if (!resolvedId) {
            dispatch({
              type: "updateAgent",
              agentId: agent.agentId,
              patch: { latestOverride: null, latestOverrideKind: null },
            });
            return;
          }
          const sessions = await client.call<SessionsListResult>("sessions.list", {
            agentId: resolvedId,
            includeGlobal: false,
            includeUnknown: false,
            limit: 48,
          });
          const entries = Array.isArray(sessions.sessions) ? sessions.sessions : [];
          const heartbeatSessions = entries.filter((entry) => {
            const label = entry.origin?.label;
            return typeof label === "string" && label.toLowerCase() === "heartbeat";
          });
          const candidates = heartbeatSessions.length > 0 ? heartbeatSessions : entries;
          const sorted = [...candidates].sort(
            (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
          );
          const sessionKey = sorted[0]?.key;
          if (!sessionKey) {
            dispatch({
              type: "updateAgent",
              agentId: agent.agentId,
              patch: { latestOverride: null, latestOverrideKind: null },
            });
            return;
          }
          const history = await client.call<ChatHistoryResult>("chat.history", {
            sessionKey,
            limit: 200,
          });
          const content = findLatestHeartbeatResponse(history.messages ?? []) ?? "";
          dispatch({
            type: "updateAgent",
            agentId: agent.agentId,
            patch: {
              latestOverride: content || null,
              latestOverrideKind: content ? "heartbeat" : null,
            },
          });
          return;
        }
        const cronResult = await listCronJobs(client, { includeDisabled: true });
        const job = resolveCronJobForAgent(cronResult.jobs, agent);
        const content = job ? formatCronJobDisplay(job) : "";
        dispatch({
          type: "updateAgent",
          agentId: agent.agentId,
          patch: {
            latestOverride: content || null,
            latestOverrideKind: content ? "cron" : null,
          },
        });
      } catch (err) {
        if (!isGatewayDisconnectLikeError(err)) {
          const message =
            err instanceof Error ? err.message : "Failed to load latest cron/heartbeat update.";
          console.error(message);
        }
      } finally {
        specialUpdateInFlightRef.current.delete(key);
      }
    },
    [client, dispatch, resolveCronJobForAgent]
  );

  const refreshHeartbeatLatestUpdate = useCallback(() => {
    const currentAgents = stateRef.current.agents;
    for (const agent of currentAgents) {
      void updateSpecialLatestUpdate(agent.agentId, agent, "heartbeat");
    }
  }, [stateRef, updateSpecialLatestUpdate]);

  // Track agent special updates
  useEffect(() => {
    for (const agent of agents) {
      const lastMessage = agent.lastUserMessage?.trim() ?? "";
      const kind = resolveSpecialUpdateKind(lastMessage);
      const key = agent.agentId;
      const marker = kind === "heartbeat" ? `${lastMessage}:${heartbeatTick}` : lastMessage;
      const previous = specialUpdateRef.current.get(key);
      if (previous === marker) continue;
      specialUpdateRef.current.set(key, marker);
      void updateSpecialLatestUpdate(agent.agentId, agent, lastMessage);
    }
  }, [agents, heartbeatTick, updateSpecialLatestUpdate]);

  return {
    heartbeatTick,
    specialUpdateRef,
    specialUpdateInFlightRef,
    updateSpecialLatestUpdate,
    refreshHeartbeatLatestUpdate,
    bumpHeartbeatTick: useCallback(() => setHeartbeatTick((prev) => prev + 1), []),
  };
}
