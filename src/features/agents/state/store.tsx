"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import type { MessagePart } from "@/lib/chat/types";

export type AgentStatus = "idle" | "running" | "error";
export type FocusFilter = "all" | "needs-attention" | "running" | "idle";
export type AgentAttention = "normal" | "needs-attention";

export type AgentStoreSeed = {
  agentId: string;
  name: string;
  sessionKey: string;
  avatarSeed?: string | null;
  avatarUrl?: string | null;
  model?: string | null;
  thinkingLevel?: string | null;
  toolCallingEnabled?: boolean;
  showThinkingTraces?: boolean;
};

export type AgentState = AgentStoreSeed & {
  status: AgentStatus;
  sessionCreated: boolean;
  awaitingUserInput: boolean;
  hasUnseenActivity: boolean;
  messageParts: MessagePart[];
  lastResult: string | null;
  lastDiff: string | null;
  runId: string | null;
  runStartedAt: number | null;
  streamText: string | null;
  thinkingTrace: string | null;
  latestOverride: string | null;
  latestOverrideKind: "heartbeat" | "cron" | null;
  lastAssistantMessageAt: number | null;
  lastActivityAt: number | null;
  latestPreview: string | null;
  lastUserMessage: string | null;
  draft: string;
  sessionSettingsSynced: boolean;
  historyLoadedAt: number | null;
  toolCallingEnabled: boolean;
  showThinkingTraces: boolean;
};

export const buildNewSessionAgentPatch = (agent: AgentState): Partial<AgentState> => {
  return {
    sessionKey: agent.sessionKey,
    status: "idle",
    runId: null,
    runStartedAt: null,
    streamText: null,
    thinkingTrace: null,
    messageParts: [],
    lastResult: null,
    lastDiff: null,
    latestOverride: null,
    latestOverrideKind: null,
    lastAssistantMessageAt: null,
    lastActivityAt: null,
    latestPreview: null,
    lastUserMessage: null,
    draft: "",
    historyLoadedAt: null,
    awaitingUserInput: false,
    hasUnseenActivity: false,
    sessionCreated: true,
    sessionSettingsSynced: true,
  };
};

export type AgentStoreState = {
  agents: AgentState[];
  selectedAgentId: string | null;
  loading: boolean;
  error: string | null;
};

export type Action =
  | { type: "hydrateAgents"; agents: AgentStoreSeed[] }
  | { type: "setError"; error: string | null }
  | { type: "setLoading"; loading: boolean }
  | { type: "updateAgent"; agentId: string; patch: Partial<AgentState> }
  | { type: "appendPart"; agentId: string; part: MessagePart }
  | { type: "updatePart"; agentId: string; index: number; patch: Partial<MessagePart> }
  | { type: "markActivity"; agentId: string; at?: number }
  | { type: "selectAgent"; agentId: string | null };

/** Maximum message parts per agent before oldest are trimmed. */
export const MAX_PARTS = 500;
/** Number of oldest parts to remove when MAX_PARTS is exceeded. */
const TRIM_COUNT = 100;

const initialState: AgentStoreState = {
  agents: [],
  selectedAgentId: null,
  loading: false,
  error: null,
};

/**
 * Preserve an existing runtime value when the session key matches,
 * otherwise fall back to the provided default.
 */
const keepIfSameSession = <T,>(
  sameSession: boolean,
  existingValue: T | undefined,
  fallback: T
): T => (sameSession ? (existingValue ?? fallback) : fallback);

const createRuntimeAgentState = (
  seed: AgentStoreSeed,
  existing?: AgentState | null
): AgentState => {
  const same = existing?.sessionKey === seed.sessionKey;
  const keep = <T,>(field: T | undefined, fallback: T): T =>
    keepIfSameSession(same, field, fallback);

  return {
    ...seed,
    // Seed-or-existing fields (always preserved across sessions)
    avatarSeed: seed.avatarSeed ?? existing?.avatarSeed ?? seed.agentId,
    avatarUrl: seed.avatarUrl ?? existing?.avatarUrl ?? null,
    model: seed.model ?? existing?.model ?? null,
    thinkingLevel: seed.thinkingLevel ?? existing?.thinkingLevel ?? "high",
    toolCallingEnabled: seed.toolCallingEnabled ?? existing?.toolCallingEnabled ?? false,
    showThinkingTraces: seed.showThinkingTraces ?? existing?.showThinkingTraces ?? true,
    // Session-scoped fields (reset when session changes)
    status: keep(existing?.status, "idle"),
    sessionCreated: keep(existing?.sessionCreated, false),
    awaitingUserInput: keep(existing?.awaitingUserInput, false),
    hasUnseenActivity: keep(existing?.hasUnseenActivity, false),
    messageParts: keep(existing?.messageParts, []),
    lastResult: keep(existing?.lastResult, null),
    lastDiff: keep(existing?.lastDiff, null),
    runId: keep(existing?.runId, null),
    runStartedAt: keep(existing?.runStartedAt, null),
    streamText: keep(existing?.streamText, null),
    thinkingTrace: keep(existing?.thinkingTrace, null),
    latestOverride: keep(existing?.latestOverride, null),
    latestOverrideKind: keep(existing?.latestOverrideKind, null),
    lastAssistantMessageAt: keep(existing?.lastAssistantMessageAt, null),
    lastActivityAt: keep(existing?.lastActivityAt, null),
    latestPreview: keep(existing?.latestPreview, null),
    lastUserMessage: keep(existing?.lastUserMessage, null),
    draft: keep(existing?.draft, ""),
    sessionSettingsSynced: keep(existing?.sessionSettingsSynced, false),
    historyLoadedAt: keep(existing?.historyLoadedAt, null),
  };
};

const reducer = (state: AgentStoreState, action: Action): AgentStoreState => {
  switch (action.type) {
    case "hydrateAgents": {
      const byId = new Map(state.agents.map((agent) => [agent.agentId, agent]));
      const agents = action.agents.map((seed) =>
        createRuntimeAgentState(seed, byId.get(seed.agentId))
      );
      const selectedAgentId =
        state.selectedAgentId && agents.some((agent) => agent.agentId === state.selectedAgentId)
          ? state.selectedAgentId
          : agents[0]?.agentId ?? null;
      return {
        ...state,
        agents,
        selectedAgentId,
        loading: false,
        error: null,
      };
    }
    case "setError":
      return { ...state, error: action.error, loading: false };
    case "setLoading":
      return { ...state, loading: action.loading };
    case "updateAgent":
      return {
        ...state,
        agents: state.agents.map((agent) =>
          agent.agentId === action.agentId
            ? { ...agent, ...action.patch }
            : agent
        ),
      };
    case "appendPart":
      return {
        ...state,
        agents: state.agents.map((agent) => {
          if (agent.agentId !== action.agentId) return agent;
          let parts = agent.messageParts;
          if (parts.length >= MAX_PARTS) {
            // Trim oldest parts, insert a marker so UI can indicate trimmed history
            const trimmed = parts.slice(TRIM_COUNT);
            const marker: MessagePart = { type: "text", text: "⋯ Earlier messages trimmed" };
            parts = [marker, ...trimmed];
          }
          return { ...agent, messageParts: [...parts, action.part] };
        }),
      };
    case "updatePart":
      return {
        ...state,
        agents: state.agents.map((agent) => {
          if (agent.agentId !== action.agentId) return agent;
          const { index, patch } = action;
          if (index < 0 || index >= agent.messageParts.length) return agent;
          const updated = { ...agent.messageParts[index], ...patch } as MessagePart;
          // Return a new array reference so consumers that memoize on
          // messageParts identity (e.g. React.memo, useMemo) correctly
          // detect the change. The spread is O(n) but n is bounded by
          // MAX_PARTS (500) and streaming deltas are already debounced.
          const newParts = agent.messageParts.slice();
          newParts[index] = updated;
          return { ...agent, messageParts: newParts };
        }),
      };
    case "markActivity": {
      const at = action.at ?? Date.now();
      return {
        ...state,
        agents: state.agents.map((agent) => {
          if (agent.agentId !== action.agentId) return agent;
          const isSelected = state.selectedAgentId === action.agentId;
          return {
            ...agent,
            lastActivityAt: at,
            hasUnseenActivity: isSelected ? false : true,
          };
        }),
      };
    }
    case "selectAgent":
      return {
        ...state,
        selectedAgentId: action.agentId,
        agents:
          action.agentId === null
            ? state.agents
            : state.agents.map((agent) =>
                agent.agentId === action.agentId
                  ? { ...agent, hasUnseenActivity: false }
                  : agent
              ),
      };
    default:
      return state;
  }
};

export const agentStoreReducer = reducer;
export const initialAgentStoreState = initialState;

type AgentStoreContextValue = {
  state: AgentStoreState;
  dispatch: React.Dispatch<Action>;
  hydrateAgents: (agents: AgentStoreSeed[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
};

const AgentStoreContext = createContext<AgentStoreContextValue | null>(null);

export const AgentStoreProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const hydrateAgents = useCallback(
    (agents: AgentStoreSeed[]) => {
      dispatch({ type: "hydrateAgents", agents });
    },
    [dispatch]
  );

  const setLoading = useCallback(
    (loading: boolean) => dispatch({ type: "setLoading", loading }),
    [dispatch]
  );

  const setError = useCallback(
    (error: string | null) => dispatch({ type: "setError", error }),
    [dispatch]
  );

  const value = useMemo(
    () => ({ state, dispatch, hydrateAgents, setLoading, setError }),
    [dispatch, hydrateAgents, setError, setLoading, state]
  );

  return (
    <AgentStoreContext.Provider value={value}>{children}</AgentStoreContext.Provider>
  );
};

export const useAgentStore = () => {
  const ctx = useContext(AgentStoreContext);
  if (!ctx) {
    throw new Error("AgentStoreProvider is missing.");
  }
  return ctx;
};

export const getSelectedAgent = (state: AgentStoreState): AgentState | null => {
  if (!state.selectedAgentId) return null;
  return state.agents.find((agent) => agent.agentId === state.selectedAgentId) ?? null;
};

export const getAttentionForAgent = (
  agent: AgentState,
  selectedAgentId: string | null
): AgentAttention => {
  if (agent.status === "error") return "needs-attention";
  if (agent.awaitingUserInput) return "needs-attention";
  if (selectedAgentId !== agent.agentId && agent.hasUnseenActivity) {
    return "needs-attention";
  }
  return "normal";
};

export const getFilteredAgents = (state: AgentStoreState, filter: FocusFilter): AgentState[] => {
  const byMostRecentAssistant = (agents: AgentState[]) =>
    [...agents].sort((a, b) => {
      const aTs = a.lastAssistantMessageAt ?? 0;
      const bTs = b.lastAssistantMessageAt ?? 0;
      if (aTs !== bTs) return bTs - aTs;
      return 0;
    });
  if (filter === "all") return byMostRecentAssistant(state.agents);
  if (filter === "running") {
    return byMostRecentAssistant(state.agents.filter((agent) => agent.status === "running"));
  }
  if (filter === "idle") {
    return byMostRecentAssistant(state.agents.filter((agent) => agent.status === "idle"));
  }
  return byMostRecentAssistant(
    state.agents.filter(
      (agent) => getAttentionForAgent(agent, state.selectedAgentId) === "needs-attention"
    )
  );
};
