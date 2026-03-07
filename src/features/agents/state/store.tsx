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
import type { WizardContext } from "@/features/wizards/lib/wizardTypes";
import type { AutonomyLevel } from "@/features/agents/lib/autonomyService";
import { DEFAULT_AUTONOMY_LEVEL } from "@/features/agents/lib/autonomyService";
import type { PersonaCategory, PersonaStatus as PersonaLifecycleStatus } from "@/features/personas/lib/personaTypes";

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
  autonomyLevel?: AutonomyLevel;
  /** Optional group/team category (e.g. "ops", "dev", "data"). */
  group?: string | null;
  /** Optional flexible labels for filtering (e.g. ["monitoring", "critical"]). */
  tags?: string[];
  // ── Persona metadata (unified model) ──────────────────────────────
  /** Whether this is the primary/main agent */
  isMainAgent?: boolean;
  /** Persona lifecycle status (draft/active/paused/archived) — distinct from runtime `status` */
  personaStatus?: PersonaLifecycleStatus | null;
  /** Persona category (sales, admin, support, etc.) */
  personaCategory?: PersonaCategory | null;
  /** Short role description from persona config */
  roleDescription?: string | null;
  /** Template key if created from Starter Kit */
  templateKey?: string | null;
  /** Optimization goals set by user */
  optimizationGoals?: string[];
  /** Number of practice sessions completed */
  practiceCount?: number;
  // ── Voice config (Phase 6: persona-agent unification) ──
  /** Voice provider (elevenlabs, openai, or null) */
  voiceProvider?: "elevenlabs" | "openai" | null;
  /** Voice ID (e.g. 'Rachel') */
  voiceId?: string | null;
  /** Voice model ID (e.g. 'eleven_flash_v2_5') */
  voiceModelId?: string | null;
  /** Voice stability (0-1, default 0.5) */
  voiceStability?: number;
  /** Voice clarity/similarity boost (0-1, default 0.75) */
  voiceClarity?: number;
  /** Voice style exaggeration (0-1, default 0) */
  voiceStyle?: number;
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
  autonomyLevel: AutonomyLevel;
  /** Optional group/team category (e.g. "ops", "dev", "data"). */
  group: string | null;
  /** Optional flexible labels for filtering (e.g. ["monitoring", "critical"]). */
  tags: string[];
  /** Active wizard context — null when no wizard is running */
  wizardContext: WizardContext | null;
  // ── Persona metadata (unified model) ──────────────────────────────
  /** Whether this is the primary/main agent */
  isMainAgent: boolean;
  /** Persona lifecycle status (draft/active/paused/archived) — distinct from runtime `status` */
  personaStatus: PersonaLifecycleStatus | null;
  /** Persona category (sales, admin, support, etc.) */
  personaCategory: PersonaCategory | null;
  /** Short role description from persona config */
  roleDescription: string | null;
  /** Template key if created from Starter Kit */
  templateKey: string | null;
  /** Optimization goals set by user */
  optimizationGoals: string[];
  /** Number of practice sessions completed */
  practiceCount: number;
  // ── Voice config (Phase 6: persona-agent unification) ──
  /** Voice provider (elevenlabs, openai, or null) */
  voiceProvider: "elevenlabs" | "openai" | null;
  /** Voice ID (e.g. 'Rachel') */
  voiceId: string | null;
  /** Voice model ID (e.g. 'eleven_flash_v2_5') */
  voiceModelId: string | null;
  /** Voice stability (0-1, default 0.5) */
  voiceStability: number;
  /** Voice clarity/similarity boost (0-1, default 0.75) */
  voiceClarity: number;
  /** Voice style exaggeration (0-1, default 0) */
  voiceStyle: number;
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
    wizardContext: null,
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
  | { type: "selectAgent"; agentId: string | null }
  | { type: "startWizard"; agentId: string; wizardContext: WizardContext }
  | { type: "endWizard"; agentId: string };

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
    autonomyLevel: seed.autonomyLevel ?? existing?.autonomyLevel ?? DEFAULT_AUTONOMY_LEVEL,
    group: seed.group ?? existing?.group ?? null,
    tags: seed.tags ?? existing?.tags ?? [],
    // Persona metadata (always preserved across sessions)
    isMainAgent: seed.isMainAgent ?? existing?.isMainAgent ?? false,
    personaStatus: seed.personaStatus ?? existing?.personaStatus ?? null,
    personaCategory: seed.personaCategory ?? existing?.personaCategory ?? null,
    roleDescription: seed.roleDescription ?? existing?.roleDescription ?? null,
    templateKey: seed.templateKey ?? existing?.templateKey ?? null,
    optimizationGoals: seed.optimizationGoals ?? existing?.optimizationGoals ?? [],
    practiceCount: seed.practiceCount ?? existing?.practiceCount ?? 0,
    // Voice config (Phase 6: persona-agent unification)
    voiceProvider: seed.voiceProvider ?? existing?.voiceProvider ?? null,
    voiceId: seed.voiceId ?? existing?.voiceId ?? null,
    voiceModelId: seed.voiceModelId ?? existing?.voiceModelId ?? null,
    voiceStability: seed.voiceStability ?? existing?.voiceStability ?? 0.5,
    voiceClarity: seed.voiceClarity ?? existing?.voiceClarity ?? 0.75,
    voiceStyle: seed.voiceStyle ?? existing?.voiceStyle ?? 0,
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
    wizardContext: keep(existing?.wizardContext, null),
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
          // .with() returns a new array with the element at `index` replaced.
          // Semantically identical to slice()+assign but avoids the intermediate
          // mutable step and is optimised in modern engines (ES2023).
          return { ...agent, messageParts: agent.messageParts.with(index, updated) };
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
    case "startWizard":
      return {
        ...state,
        agents: state.agents.map((agent) =>
          agent.agentId === action.agentId
            ? { ...agent, wizardContext: action.wizardContext }
            : agent
        ),
      };
    case "endWizard":
      return {
        ...state,
        agents: state.agents.map((agent) =>
          agent.agentId === action.agentId
            ? { ...agent, wizardContext: null }
            : agent
        ),
      };
    default:
      return state;
  }
};

export const agentStoreReducer = reducer;
export const initialAgentStoreState = initialState;

/**
 * Context is split into two providers to prevent unnecessary re-renders:
 *
 * - AgentDispatchContext: stable — dispatch + action helpers never change.
 *   Components that only dispatch actions can use `useAgentDispatch()` and
 *   will never re-render due to state changes.
 *
 * - AgentStateContext: changes on every dispatch (expected). Components that
 *   read state subscribe here. Use `useAgentState()` directly, or use
 *   `useAgentStore()` for backward-compatible combined access.
 *
 * Migration path: replace `const { dispatch } = useAgentStore()` with
 * `const { dispatch } = useAgentDispatch()` in action-only components.
 */

type AgentDispatchContextValue = {
  dispatch: React.Dispatch<Action>;
  hydrateAgents: (agents: AgentStoreSeed[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
};

type AgentStateContextValue = {
  state: AgentStoreState;
};

// Kept for backward compatibility — consumers that use useAgentStore() still work.
type AgentStoreContextValue = AgentDispatchContextValue & AgentStateContextValue;

const AgentDispatchContext = createContext<AgentDispatchContextValue | null>(null);
const AgentStateContext = createContext<AgentStateContextValue | null>(null);

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

  // Stable: dispatch and helpers never change after mount.
  // Components that only call actions avoid state-change re-renders.
  const dispatchValue = useMemo<AgentDispatchContextValue>(
    () => ({ dispatch, hydrateAgents, setLoading, setError }),
    [dispatch, hydrateAgents, setLoading, setError]
  );

  // Changes every dispatch — intentional. State consumers expect this.
  const stateValue = useMemo<AgentStateContextValue>(() => ({ state }), [state]);

  return (
    <AgentDispatchContext.Provider value={dispatchValue}>
      <AgentStateContext.Provider value={stateValue}>
        {children}
      </AgentStateContext.Provider>
    </AgentDispatchContext.Provider>
  );
};

/** Action-only hook — stable, never re-renders due to state changes. */
export const useAgentDispatch = (): AgentDispatchContextValue => {
  const ctx = useContext(AgentDispatchContext);
  if (!ctx) {
    throw new Error("AgentStoreProvider is missing.");
  }
  return ctx;
};

/** State-only hook — re-renders whenever agent state changes. */
export const useAgentState = (): AgentStateContextValue => {
  const ctx = useContext(AgentStateContext);
  if (!ctx) {
    throw new Error("AgentStoreProvider is missing.");
  }
  return ctx;
};

/**
 * Combined hook for backward compatibility.
 * Prefer `useAgentDispatch()` in action-only components to avoid
 * unnecessary re-renders.
 */
export const useAgentStore = (): AgentStoreContextValue => {
  const dispatchCtx = useContext(AgentDispatchContext);
  const stateCtx = useContext(AgentStateContext);
  if (!dispatchCtx || !stateCtx) {
    throw new Error("AgentStoreProvider is missing.");
  }
  return { ...dispatchCtx, ...stateCtx };
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

// Module-level comparator — not recreated on every `getFilteredAgents` call.
const compareByMostRecentAssistant = (a: AgentState, b: AgentState): number =>
  (b.lastAssistantMessageAt ?? 0) - (a.lastAssistantMessageAt ?? 0);

const sortByMostRecentAssistant = (agents: AgentState[]): AgentState[] =>
  [...agents].sort(compareByMostRecentAssistant);

export const getFilteredAgents = (state: AgentStoreState, filter: FocusFilter): AgentState[] => {
  if (filter === "all") return sortByMostRecentAssistant(state.agents);
  if (filter === "running") {
    return sortByMostRecentAssistant(state.agents.filter((agent) => agent.status === "running"));
  }
  if (filter === "idle") {
    return sortByMostRecentAssistant(state.agents.filter((agent) => agent.status === "idle"));
  }
  return sortByMostRecentAssistant(
    state.agents.filter(
      (agent) => getAttentionForAgent(agent, state.selectedAgentId) === "needs-attention"
    )
  );
};
