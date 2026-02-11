"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";
import {
  AgentBrainPanel,
  AgentSettingsPanel,
} from "@/features/agents/components/AgentInspectPanels";
import { FleetSidebar, type SubAgentEntry, type AgentTokenInfo } from "@/features/agents/components/FleetSidebar";
import { HeaderBar } from "@/features/agents/components/HeaderBar";
import { ConnectionPanel } from "@/features/agents/components/ConnectionPanel";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
import { BrandMark } from "@/components/brand/BrandMark";
import {
  buildAgentInstruction,
} from "@/lib/text/message-extract";
import { useGatewayConnection } from "@/lib/gateway/GatewayClient";
import {
  type GatewayModelPolicySnapshot,
} from "@/lib/gateway/models";
import {
  AgentStoreProvider,
  buildNewSessionAgentPatch,
  getFilteredAgents,
  getSelectedAgent,
  type FocusFilter,
  useAgentStore,
} from "@/features/agents/state/store";
import {
  buildSummarySnapshotPatches,
  type SummaryPreviewSnapshot,
  type SummarySnapshotAgent,
  type SummaryStatusSnapshot,
} from "@/features/agents/state/runtimeEventBridge";
import type { AgentStoreSeed } from "@/features/agents/state/store";
import { createGatewayRuntimeEventHandler } from "@/features/agents/state/gatewayRuntimeEventHandler";
import { createStudioSettingsCoordinator } from "@/lib/studio/coordinator";
import { resolveAgentAvatarSeed, resolveFocusedPreference } from "@/lib/studio/settings";
import { applySessionSettingMutation } from "@/features/agents/state/sessionSettingsMutations";
import {
  buildAgentMainSessionKey,
  isSameSessionKey,
  isGatewayDisconnectLikeError,
  syncGatewaySessionSettings,
  type EventFrame,
} from "@/lib/gateway/GatewayClient";
import { ArtifactsPanel } from "@/features/artifacts/components/ArtifactsPanel";
import { TasksPanel } from "@/features/tasks/components/TasksPanel";
import { ContextPanel, type ContextTab } from "@/features/context/components/ContextPanel";
import { ExecApprovalOverlay } from "@/features/exec-approvals/components/ExecApprovalOverlay";
import {
  parseExecApprovalRequested,
  parseExecApprovalResolved,
  pruneExpired,
} from "@/features/exec-approvals/types";
import { ChannelsPanel } from "@/features/channels/components/ChannelsPanel";
import { SessionsPanel } from "@/features/sessions/components/SessionsPanel";
import { CronPanel } from "@/features/cron/components/CronPanel";
import { StatusBar } from "@/features/status/components/StatusBar";
import { useChannelsStatus } from "@/features/channels/hooks/useChannelsStatus";
import { useAllSessions } from "@/features/sessions/hooks/useAllSessions";
import { useAllCronJobs } from "@/features/cron/hooks/useAllCronJobs";
import { useExecApprovals } from "@/features/exec-approvals/hooks/useExecApprovals";
import { useSessionUsage, useCumulativeUsage } from "@/features/sessions/hooks/useSessionUsage";
import { useGatewayStatus } from "@/features/status/hooks/useGatewayStatus";
import { ConfigMutationModals } from "@/features/agents/components/ConfigMutationModals";
import type { MobilePane } from "@/features/agents/components/MobilePaneToggle";
import { useConfigMutationQueue } from "@/features/agents/hooks/useConfigMutationQueue";
import { useDraftBatching } from "@/features/agents/hooks/useDraftBatching";
import { useLivePatchBatching } from "@/features/agents/hooks/useLivePatchBatching";
import { useSpecialUpdates } from "@/features/agents/hooks/useSpecialUpdates";
import { useAgentHistorySync } from "@/features/agents/hooks/useAgentHistorySync";
import { useAgentLifecycle } from "@/features/agents/hooks/useAgentLifecycle";
import { useGatewayModels } from "@/features/agents/hooks/useGatewayModels";
import { useSettingsPanel } from "@/features/agents/hooks/useSettingsPanel";

type AgentsListResult = {
  defaultId: string;
  mainKey: string;
  scope?: string;
  agents: Array<{
    id: string;
    name?: string;
    identity?: {
      name?: string;
      theme?: string;
      emoji?: string;
      avatar?: string;
      avatarUrl?: string;
    };
  }>;
};

type SessionsListEntry = {
  key: string;
  updatedAt?: number | null;
  displayName?: string;
  origin?: { label?: string | null; provider?: string | null } | null;
  thinkingLevel?: string;
  modelProvider?: string;
  model?: string;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  contextTokens?: number | null;
};

type SessionsListResult = {
  sessions?: SessionsListEntry[];
};

const RESERVED_MAIN_AGENT_ID = "main";

const AgentStudioPage = () => {
  const [settingsCoordinator] = useState(() => createStudioSettingsCoordinator());
  const {
    client,
    status,
    gatewayUrl,
    token,
    error: gatewayError,
    connect,
    disconnect,
    setGatewayUrl,
    setToken,
  } = useGatewayConnection(settingsCoordinator);

  const { state, dispatch, hydrateAgents, setError, setLoading } = useAgentStore();
  const [showConnectionPanel, setShowConnectionPanel] = useState(false);
  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");
  const [focusedPreferencesLoaded, setFocusedPreferencesLoaded] = useState(false);
  const [agentsLoadedOnce, setAgentsLoadedOnce] = useState(false);
  const stateRef = useRef(state);
  const focusFilterTouchedRef = useRef(false);
  const sessionsUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cronUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [subAgentRunningKeys, setSubAgentRunningKeys] = useState<Set<string>>(new Set());

  // Stable refs for load functions — avoids useEffect dependency cascades that
  // cause event handler teardown/recreation loops and RPC call storms.
  // Initialized with no-ops; updated after their hooks define them below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadAllCronJobsRef = useRef<() => Promise<any>>(() => Promise.resolve());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadAllSessionsRef = useRef<() => Promise<any>>(() => Promise.resolve());
  const loadChannelsStatusRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const loadCumulativeUsageRef = useRef<() => Promise<void>>(() => Promise.resolve());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadSummarySnapshotRef = useRef<() => Promise<any>>(() => Promise.resolve());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadAgentHistoryRef = useRef<(agentId: string) => Promise<any>>(() => Promise.resolve());
  const refreshHeartbeatLatestUpdateRef = useRef<() => void>(() => {});
  const loadSessionUsageRef = useRef<(key: string) => Promise<void>>(() => Promise.resolve());
  const refreshContextWindowRef = useRef<(agentId: string, sessionKey: string) => Promise<void>>(() => Promise.resolve());
  const {
    gatewayModels,
    gatewayModelsError,
    gatewayConfigSnapshot,
    setGatewayConfigSnapshot,
    resolveDefaultModelForAgent,
  } = useGatewayModels(client, status);
  const [stopBusyAgentId, setStopBusyAgentId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("chat");
  /** "agent" = show ContextPanel (Tasks/Brain/Settings), "files" = show Files */
  const [contextMode, setContextMode] = useState<"agent" | "files">("agent");
  const [contextTab, setContextTab] = useState<ContextTab>("settings");
  const [viewingSessionKey, setViewingSessionKey] = useState<string | null>(null);
  const [viewingSessionHistory, setViewingSessionHistory] = useState<string[]>([]);
  const [viewingSessionLoading, setViewingSessionLoading] = useState(false);
  const [isCompacting, setIsCompacting] = useState(false);
  const [lastCompactedAt, setLastCompactedAt] = useState<number | null>(null);
  /** Context window utilization per agent — totalTokens = last turn's prompt size, contextTokens = model limit */
  const [agentContextWindow, setAgentContextWindow] = useState<Map<string, { totalTokens: number; contextTokens: number }>>(new Map());
  const gatewayConfigSnapshotRef = useRef(gatewayConfigSnapshot);
  gatewayConfigSnapshotRef.current = gatewayConfigSnapshot;

  const runtimeEventHandlerRef = useRef<ReturnType<typeof createGatewayRuntimeEventHandler> | null>(
    null
  );

  // Extracted hooks
  const {
    execApprovalQueue, setExecApprovalQueue,
    execApprovalBusy, execApprovalError,
    handleExecApprovalDecision, resetExecApprovals,
  } = useExecApprovals(client);

  const {
    channelsSnapshot, channelsLoading, channelsError,
    connectedChannelCount, totalChannelCount,
    loadChannelsStatus, resetChannelsStatus,
  } = useChannelsStatus(client, status);

  const {
    gatewayVersion, gatewayUptime, presenceAgentIds,
    loadGatewayStatus, parsePresenceFromStatus, resetPresence,
  } = useGatewayStatus(client, status);

  const {
    sessionUsage, sessionUsageLoading,
    loadSessionUsage, resetSessionUsage,
  } = useSessionUsage(client, status);

  const {
    cumulativeUsage, cumulativeUsageLoading,
    loadCumulativeUsage, resetCumulativeUsage,
  } = useCumulativeUsage(client, status);

  const {
    allSessions, allSessionsLoading, allSessionsError,
    totalSessionCount, aggregateTokensFromList, loadAllSessions,
  } = useAllSessions(client, status);

  const {
    allCronJobs, allCronLoading, allCronError,
    allCronRunBusyJobId, allCronDeleteBusyJobId,
    loadAllCronJobs, handleAllCronRunJob, handleAllCronDeleteJob,
  } = useAllCronJobs(client, status);

  // Keep load-function refs current (avoids stale closures)
  loadAllCronJobsRef.current = loadAllCronJobs;
  loadAllSessionsRef.current = loadAllSessions;
  loadChannelsStatusRef.current = loadChannelsStatus;
  loadCumulativeUsageRef.current = loadCumulativeUsage;

  const { flushPendingDraft, handleDraftChange, pendingDraftValuesRef, pendingDraftTimersRef } =
    useDraftBatching(dispatch);

  const { queueLivePatch, clearPendingLivePatch } = useLivePatchBatching(dispatch);

  const agents = state.agents;
  const {
    settingsAgentId, setSettingsAgentId, settingsAgent,
    settingsCronJobs, settingsCronLoading, settingsCronError,
    cronRunBusyJobId, cronDeleteBusyJobId,
    settingsHeartbeats, settingsHeartbeatLoading, settingsHeartbeatError,
    heartbeatRunBusyId, heartbeatDeleteBusyId,
    handleRunCronJob, handleDeleteCronJob,
    handleRunHeartbeat, handleDeleteHeartbeat,
  } = useSettingsPanel({ client, status, agents });
  const selectedAgent = useMemo(() => getSelectedAgent(state), [state]);
  const filteredAgents = useMemo(
    () => getFilteredAgents(state, focusFilter),
    [focusFilter, state]
  );
  const focusedAgent = useMemo(() => {
    if (filteredAgents.length === 0) return null;
    const selectedInFilter = selectedAgent
      ? filteredAgents.find((entry) => entry.agentId === selectedAgent.agentId)
      : null;
    return selectedInFilter ?? filteredAgents[0] ?? null;
  }, [filteredAgents, selectedAgent]);
  const focusedAgentId = focusedAgent?.agentId ?? null;
  const focusedAgentRef = useRef(focusedAgent);
  focusedAgentRef.current = focusedAgent;
  const focusedAgentRunning = focusedAgent?.status === "running";
  const selectedBrainAgentId = useMemo(() => {
    return focusedAgent?.agentId ?? agents[0]?.agentId ?? null;
  }, [agents, focusedAgent]);
  const subAgentSessions = useMemo(() => {
    const map = new Map<string, SubAgentEntry[]>();
    for (const session of allSessions) {
      const key = session.key;
      // Pattern: agent:<name>:subagent:<uuid>
      const match = key.match(/^agent:([^:]+):subagent:(.+)$/);
      if (!match) continue;
      const parentAgentId = match[1];
      const subId = match[2];
      const updatedAt = session.updatedAt ?? null;
      const isRunning = subAgentRunningKeys.has(key);
      const entry: SubAgentEntry = {
        sessionKey: key,
        sessionIdShort: subId.slice(0, 6),
        parentAgentId,
        updatedAt,
        isRunning,
      };
      const existing = map.get(parentAgentId);
      if (existing) {
        existing.push(entry);
      } else {
        map.set(parentAgentId, [entry]);
      }
    }
    // Sort each agent's sub-agents by updatedAt desc, limit to 5
    for (const [agentId, entries] of map) {
      entries.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      if (entries.length > 5) map.set(agentId, entries.slice(0, 5));
    }
    return map;
  }, [allSessions, subAgentRunningKeys]);

  // Build token info map for Fleet sidebar progress bars
  // Match a model key (could be "claude-opus-4-6" or "anthropic/claude-opus-4-6") against gateway model list
  const findModelMatch = useCallback(
    (modelKey: string | undefined | null) => {
      if (!modelKey) return undefined;
      return gatewayModels.find(
        (m) => `${m.provider}/${m.id}` === modelKey || m.id === modelKey
      );
    },
    [gatewayModels]
  );

  const agentTokenInfo = useMemo(() => {
    const map = new Map<string, AgentTokenInfo>();
    if (focusedAgent) {
      const cw = agentContextWindow.get(focusedAgent.agentId);
      if (cw && cw.totalTokens > 0) {
        // Use last turn's totalTokens (actual context utilization) and contextTokens from gateway
        const limit = cw.contextTokens > 0 ? cw.contextTokens : findModelMatch(focusedAgent.model)?.contextWindow;
        map.set(focusedAgent.agentId, {
          used: cw.totalTokens,
          limit,
        });
      } else if (sessionUsage) {
        // Fallback: use cumulative usage (less accurate but better than nothing)
        const match = findModelMatch(focusedAgent.model);
        map.set(focusedAgent.agentId, {
          used: sessionUsage.inputTokens + sessionUsage.outputTokens,
          limit: match?.contextWindow,
        });
      }
    }
    return map;
  }, [focusedAgent, agentContextWindow, sessionUsage, findModelMatch]);

  const faviconHref = "/branding/trident.svg";
  const errorMessage = state.error ?? gatewayModelsError;
  const runningAgentCount = useMemo(
    () => agents.filter((agent) => agent.status === "running").length,
    [agents]
  );
  const hasRunningAgents = runningAgentCount > 0;

  const {
    specialUpdateRef,
    specialUpdateInFlightRef,
    updateSpecialLatestUpdate,
    refreshHeartbeatLatestUpdate,
    bumpHeartbeatTick,
  } = useSpecialUpdates({ client, dispatch, agents, stateRef });

  refreshHeartbeatLatestUpdateRef.current = refreshHeartbeatLatestUpdate;

  const handleFocusFilterChange = useCallback(
    (next: FocusFilter) => {
      flushPendingDraft(focusedAgent?.agentId ?? null);
      focusFilterTouchedRef.current = true;
      setFocusFilter(next);
    },
    [flushPendingDraft, focusedAgent]
  );

  // ── Load additional data on connect ─────────────────────────────
  useEffect(() => {
    if (status !== "connected") {
      resetChannelsStatus();
      resetExecApprovals();
      resetPresence();
      resetSessionUsage();
      resetCumulativeUsage();
      return;
    }
    void loadGatewayStatus();
    void parsePresenceFromStatus();
    void loadCumulativeUsageRef.current();
    // Note: loadAllSessions, loadAllCronJobs, loadChannelsStatus are called
    // from the agent-load effect below (with mutation guards) to avoid duplicates.
  }, [loadGatewayStatus, parsePresenceFromStatus, resetChannelsStatus, resetExecApprovals, resetPresence, resetSessionUsage, resetCumulativeUsage, status]);

  // ── Refresh context window utilization from sessions.list ──────────────
  const refreshContextWindow = useCallback(async (agentId: string, sessionKey: string) => {
    if (status !== "connected") return;
    try {
      const result = await client.call<SessionsListResult>("sessions.list", {
        agentId,
        includeGlobal: false,
        includeUnknown: false,
        search: sessionKey,
        limit: 4,
      });
      const entries = Array.isArray(result.sessions) ? result.sessions : [];
      const match = entries.find((e) => isSameSessionKey(e.key ?? "", sessionKey));
      if (match && typeof match.totalTokens === "number" && match.totalTokens > 0) {
        const ct = typeof match.contextTokens === "number" ? match.contextTokens : 0;
        // Detect stale token counts: when totalTokens == contextTokens (maxed out)
        // but actual usage (inputTokens + outputTokens) is much smaller, the session
        // was reset but the gateway didn't clear the counters. Skip stale data.
        const actualUsage = (typeof match.inputTokens === "number" ? match.inputTokens : 0)
          + (typeof match.outputTokens === "number" ? match.outputTokens : 0);
        const looksStale = ct > 0 && match.totalTokens >= ct && actualUsage < ct * 0.5;
        if (!looksStale) {
          setAgentContextWindow((prev) => {
            const next = new Map(prev);
            next.set(agentId, {
              totalTokens: match.totalTokens!,
              contextTokens: ct,
            });
            return next;
          });
        }
      }
    } catch {
      // Silently ignore — progress bar will use fallback
    }
  }, [client, status]);

  // Keep refs current for session usage and context window
  loadSessionUsageRef.current = loadSessionUsage;
  refreshContextWindowRef.current = refreshContextWindow;

  // ── Load session usage for the focused agent (primitive deps to avoid cascade) ──
  const focusedSessionKey = focusedAgent?.sessionKey ?? null;
  const focusedAgentStatus = focusedAgent?.status ?? null;

  useEffect(() => {
    if (!focusedSessionKey || !focusedAgentId) {
      resetSessionUsage();
      return;
    }
    void loadSessionUsageRef.current(focusedSessionKey);
    void refreshContextWindowRef.current(focusedAgentId, focusedSessionKey);
  }, [focusedAgentId, focusedSessionKey, resetSessionUsage]);

  // Reload usage when turn completes (running → idle). No polling — event-driven only.
  const prevStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!focusedSessionKey || !focusedAgentId) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = focusedAgentStatus ?? undefined;
    if (prev === "running" && focusedAgentStatus === "idle") {
      void loadSessionUsageRef.current(focusedSessionKey);
      void refreshContextWindowRef.current(focusedAgentId, focusedSessionKey);
      void loadCumulativeUsageRef.current();
    }
  }, [focusedAgentId, focusedSessionKey, focusedAgentStatus]);

  // Aggregate usage: use the focused session's usage as the primary data source
  // (per-session usage loads lazily in SessionsPanel cards)
  const aggregateUsage = useMemo(() => {
    if (!sessionUsage) return null;
    return {
      inputTokens: sessionUsage.inputTokens,
      outputTokens: sessionUsage.outputTokens,
      totalCost: sessionUsage.totalCost,
      messageCount: sessionUsage.messageCount,
    };
  }, [sessionUsage]);
  const aggregateUsageLoading = sessionUsageLoading;

  useEffect(() => {
    const selector = 'link[data-agent-favicon="true"]';
    const existing = document.querySelector(selector) as HTMLLinkElement | null;
    if (!faviconHref) {
      existing?.remove();
      return;
    }
    if (existing) {
      if (existing.href !== faviconHref) {
        existing.href = faviconHref;
      }
      return;
    }
    const link = document.createElement("link");
    link.rel = "icon";
    link.type = "image/svg+xml";
    link.href = faviconHref;
    link.setAttribute("data-agent-favicon", "true");
    document.head.appendChild(link);
  }, [faviconHref]);

  const resolveAgentName = useCallback((agent: AgentsListResult["agents"][number]) => {
    const fromList = typeof agent.name === "string" ? agent.name.trim() : "";
    if (fromList) return fromList;
    const fromIdentity =
      typeof agent.identity?.name === "string" ? agent.identity.name.trim() : "";
    if (fromIdentity) return fromIdentity;
    return agent.id;
  }, []);

  const resolveAgentAvatarUrl = useCallback(
    (agent: AgentsListResult["agents"][number]) => {
      const candidate = agent.identity?.avatarUrl ?? agent.identity?.avatar ?? null;
      if (typeof candidate !== "string") return null;
      const trimmed = candidate.trim();
      if (!trimmed) return null;
      if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
      if (trimmed.startsWith("data:image/")) return trimmed;
      return null;
    },
    []
  );

  const loadAgents = useCallback(async () => {
    if (status !== "connected") return;
    setLoading(true);
    try {
      let configSnapshot = gatewayConfigSnapshotRef.current;
      if (!configSnapshot) {
        try {
          configSnapshot = await client.call<GatewayModelPolicySnapshot>("config.get", {});
          setGatewayConfigSnapshot(configSnapshot);
          gatewayConfigSnapshotRef.current = configSnapshot;
        } catch (err) {
          if (!isGatewayDisconnectLikeError(err)) {
            console.error("Failed to load gateway config while loading agents.", err);
          }
        }
      }
      const gatewayKey = gatewayUrl.trim();
      let settings: Awaited<ReturnType<typeof settingsCoordinator.loadSettings>> | null = null;
      if (gatewayKey) {
        try {
          settings = await settingsCoordinator.loadSettings();
        } catch (err) {
          console.error("Failed to load studio settings while loading agents.", err);
        }
      }
      const agentsResult = await client.call<AgentsListResult>("agents.list", {});
      const mainKey = agentsResult.mainKey?.trim() || "main";

      // Filter out phantom agents injected by the gateway's mainKey fallback.
      const configuredAgentIds = new Set(
        (configSnapshot?.config?.agents?.list ?? [])
          .map((entry: { id?: string }) => entry?.id?.trim()?.toLowerCase())
          .filter(Boolean)
      );
      const realAgents =
        configuredAgentIds.size > 0
          ? agentsResult.agents.filter(
              (agent) =>
                configuredAgentIds.has(agent.id?.toLowerCase()) ||
                agent.id === agentsResult.defaultId
            )
          : agentsResult.agents;

      const mainSessionKeyByAgent = new Map<string, SessionsListEntry | null>();
      await Promise.all(
        realAgents.map(async (agent) => {
          try {
            const expectedMainKey = buildAgentMainSessionKey(agent.id, mainKey);
            const sessions = await client.call<SessionsListResult>("sessions.list", {
              agentId: agent.id,
              includeGlobal: false,
              includeUnknown: false,
              search: expectedMainKey,
              limit: 4,
            });
            const entries = Array.isArray(sessions.sessions) ? sessions.sessions : [];
            const mainEntry =
              entries.find((entry) => isSameSessionKey(entry.key ?? "", expectedMainKey)) ?? null;
            mainSessionKeyByAgent.set(agent.id, mainEntry);
          } catch (err) {
            if (!isGatewayDisconnectLikeError(err)) {
              console.error("Failed to list sessions while resolving agent session.", err);
            }
            mainSessionKeyByAgent.set(agent.id, null);
          }
        })
      );
      const seeds: AgentStoreSeed[] = realAgents.map((agent) => {
        const persistedSeed =
          settings && gatewayKey ? resolveAgentAvatarSeed(settings, gatewayKey, agent.id) : null;
        const avatarSeed = persistedSeed ?? agent.id;
        const avatarUrl = resolveAgentAvatarUrl(agent);
        const name = resolveAgentName(agent);
        const mainSession = mainSessionKeyByAgent.get(agent.id) ?? null;
        const modelProvider =
          typeof mainSession?.modelProvider === "string" ? mainSession.modelProvider.trim() : "";
        const modelId = typeof mainSession?.model === "string" ? mainSession.model.trim() : "";
        const model =
          modelProvider && modelId
            ? `${modelProvider}/${modelId}`
            : resolveDefaultModelForAgent(agent.id, configSnapshot);
        const thinkingLevel =
          typeof mainSession?.thinkingLevel === "string" ? mainSession.thinkingLevel : null;
        return {
          agentId: agent.id,
          name,
          sessionKey: buildAgentMainSessionKey(agent.id, mainKey),
          avatarSeed,
          avatarUrl,
          model,
          thinkingLevel,
        };
      });
      hydrateAgents(seeds);
      // Capture context window utilization from sessions.list
      const cwMap = new Map<string, { totalTokens: number; contextTokens: number }>();
      for (const seed of seeds) {
        const mainSession = mainSessionKeyByAgent.get(seed.agentId) ?? null;
        if (!mainSession) continue;
        dispatch({
          type: "updateAgent",
          agentId: seed.agentId,
          patch: { sessionCreated: true, sessionSettingsSynced: true },
        });
        if (typeof mainSession.totalTokens === "number" && mainSession.totalTokens > 0) {
          const ct = typeof mainSession.contextTokens === "number" ? mainSession.contextTokens : 0;
          const actualUsage = (typeof mainSession.inputTokens === "number" ? mainSession.inputTokens : 0)
            + (typeof mainSession.outputTokens === "number" ? mainSession.outputTokens : 0);
          const looksStale = ct > 0 && mainSession.totalTokens >= ct && actualUsage < ct * 0.5;
          if (!looksStale) {
            cwMap.set(seed.agentId, {
              totalTokens: mainSession.totalTokens,
              contextTokens: ct,
            });
          }
        }
      }
      if (cwMap.size > 0) setAgentContextWindow(cwMap);

      try {
        const activeAgents: SummarySnapshotAgent[] = [];
        for (const seed of seeds) {
          const mainSession = mainSessionKeyByAgent.get(seed.agentId) ?? null;
          if (!mainSession) continue;
          activeAgents.push({
            agentId: seed.agentId,
            sessionKey: seed.sessionKey,
            status: "idle",
          });
        }
        const sessionKeys = Array.from(
          new Set(
            activeAgents
              .map((agent) => agent.sessionKey)
              .filter((key): key is string => typeof key === "string" && key.trim().length > 0)
          )
        ).slice(0, 64);
        if (sessionKeys.length > 0) {
          const [statusSummary, previewResult] = await Promise.all([
            client.call<SummaryStatusSnapshot>("status", {}),
            client.call<SummaryPreviewSnapshot>("sessions.preview", {
              keys: sessionKeys,
              limit: 8,
              maxChars: 240,
            }),
          ]);
          const patches = buildSummarySnapshotPatches({
            agents: activeAgents,
            statusSummary,
            previewResult,
          });
          const assistantAtByAgentId = new Map<string, number>();
          for (const entry of patches) {
            if (typeof entry.patch.lastAssistantMessageAt === "number") {
              assistantAtByAgentId.set(entry.agentId, entry.patch.lastAssistantMessageAt);
            }
          }
          for (const entry of patches) {
            dispatch({
              type: "updateAgent",
              agentId: entry.agentId,
              patch: entry.patch,
            });
          }

          let bestAgentId: string | null = seeds[0]?.agentId ?? null;
          let bestTs = bestAgentId ? (assistantAtByAgentId.get(bestAgentId) ?? 0) : 0;
          for (const seed of seeds) {
            const ts = assistantAtByAgentId.get(seed.agentId) ?? 0;
            if (ts <= bestTs) continue;
            bestTs = ts;
            bestAgentId = seed.agentId;
          }
          if (bestAgentId) {
            dispatch({ type: "selectAgent", agentId: bestAgentId });
          }
        }
      } catch (err) {
        if (!isGatewayDisconnectLikeError(err)) {
          console.error("Failed to load initial summary snapshot.", err);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load agents.";
      setError(message);
    } finally {
      setLoading(false);
      setAgentsLoadedOnce(true);
    }
  }, [
    client,
    dispatch,
    hydrateAgents,
    resolveAgentAvatarUrl,
    resolveAgentName,
    resolveDefaultModelForAgent,
    setError,
    setLoading,
    setGatewayConfigSnapshot,
    gatewayUrl,
    settingsCoordinator,
    status,
  ]);

  // Break circular dependency: useAgentLifecycle needs enqueueConfigMutation,
  // useConfigMutationQueue needs lifecycle block phases. Use a ref.
  const enqueueConfigMutationRef = useRef<(params: {
    kind: "create-agent" | "rename-agent" | "delete-agent";
    label: string;
    run: () => Promise<void>;
  }) => Promise<void>>(async () => {});

  const {
    deleteAgentBlock,
    createAgentBlock,
    renameAgentBlock,
    deleteConfirmAgentId,
    setDeleteConfirmAgentId,
    createAgentBusy,
    handleCreateAgent,
    handleConfirmDeleteAgent,
    handleDeleteAgent,
    handleRenameAgent,
  } = useAgentLifecycle({
    client,
    dispatch,
    agents,
    stateRef,
    status,
    setError,
    enqueueConfigMutation: useCallback(
      (params: { kind: "create-agent" | "rename-agent" | "delete-agent"; label: string; run: () => Promise<void> }) =>
        enqueueConfigMutationRef.current(params),
      []
    ),
    loadAgents,
    flushPendingDraft,
    focusedAgentId: focusedAgent?.agentId ?? null,
    setFocusFilter,
    focusFilterTouchedRef,
    setSettingsAgentId,
    setMobilePane,
  });

  const {
    activeConfigMutation,
    enqueueConfigMutation,
    queuedConfigMutationCount,
  } = useConfigMutationQueue({
    hasRunningAgents,
    deleteAgentBlockPhase: deleteAgentBlock?.phase ?? null,
    createAgentBlockPhase: createAgentBlock?.phase ?? null,
    renameAgentBlockPhase: renameAgentBlock?.phase ?? null,
    status,
  });

  // Wire the real enqueueConfigMutation into the ref
  useEffect(() => {
    enqueueConfigMutationRef.current = enqueueConfigMutation;
  }, [enqueueConfigMutation]);

  const { historyInFlightRef, loadAgentHistory } = useAgentHistorySync({
    client,
    dispatch,
    agents,
    stateRef,
    status,
    focusedAgentId,
    focusedAgentRunning,
  });

  loadAgentHistoryRef.current = loadAgentHistory;

  // Update stateRef synchronously during render (not in useEffect) so that
  // WebSocket event handlers reading stateRef.current always see the latest
  // dispatched state, not the state from the previous render cycle.
  stateRef.current = state;

  useEffect(() => {
    if (status === "connected") return;
    setAgentsLoadedOnce(false);
  }, [gatewayUrl, status]);

  useEffect(() => {
    let cancelled = false;
    const key = gatewayUrl.trim();
    if (!key) {
      setFocusedPreferencesLoaded(true);
      return;
    }
    setFocusedPreferencesLoaded(false);
    focusFilterTouchedRef.current = false;
    const loadFocusedPreferences = async () => {
      try {
        const settings = await settingsCoordinator.loadSettings();
        if (cancelled || !settings) {
          return;
        }
        if (focusFilterTouchedRef.current) {
          return;
        }
        const preference = resolveFocusedPreference(settings, key);
        if (preference) {
          setFocusFilter(preference.filter);
          return;
        }
        setFocusFilter("all");
      } catch (err) {
        console.error("Failed to load focused preference.", err);
      } finally {
        if (!cancelled) {
          setFocusedPreferencesLoaded(true);
        }
      }
    };
    void loadFocusedPreferences();
    return () => {
      cancelled = true;
    };
  }, [gatewayUrl, settingsCoordinator]);

  useEffect(() => {
    return () => {
      void settingsCoordinator.flushPending();
    };
  }, [settingsCoordinator]);

  useEffect(() => {
    const key = gatewayUrl.trim();
    if (!focusedPreferencesLoaded || !key) return;
    settingsCoordinator.schedulePatch(
      {
        focused: {
          [key]: {
            mode: "focused",
            filter: focusFilter,
          },
        },
      },
      300
    );
  }, [focusFilter, focusedPreferencesLoaded, gatewayUrl, settingsCoordinator]);

  useEffect(() => {
    if (status !== "connected" || !focusedPreferencesLoaded) return;
    if (deleteAgentBlock && deleteAgentBlock.phase !== "queued") return;
    if (createAgentBlock && createAgentBlock.phase !== "queued") return;
    if (renameAgentBlock && renameAgentBlock.phase !== "queued") return;
    void loadAgents();
    void loadChannelsStatusRef.current();
    void loadAllSessionsRef.current();
    void loadAllCronJobsRef.current();
  }, [
    createAgentBlock,
    deleteAgentBlock,
    focusedPreferencesLoaded,
    gatewayUrl,
    loadAgents,
    renameAgentBlock,
    status,
  ]);

  useEffect(() => {
    if (status === "disconnected") {
      setLoading(false);
    }
  }, [setLoading, status]);

  // When the selected agent changes, update settings to follow if the settings tab is active
  useEffect(() => {
    if (!state.selectedAgentId) return;
    if (contextTab === "settings" && state.selectedAgentId !== settingsAgentId) {
      setSettingsAgentId(state.selectedAgentId);
    } else if (settingsAgentId && state.selectedAgentId !== settingsAgentId) {
      setSettingsAgentId(null);
    }
  }, [contextTab, settingsAgentId, setSettingsAgentId, state.selectedAgentId]);

  // Settings agent reset + cron/heartbeat loading handled by useSettingsPanel hook

  // Auto-close brain tab in context panel if no agents
  useEffect(() => {
    if (contextTab !== "brain" || contextMode !== "agent") return;
    if (selectedBrainAgentId) return;
    setContextTab("tasks");
  }, [contextMode, contextTab, selectedBrainAgentId]);

  // Auto-close context panel settings tab if no agent selected
  useEffect(() => {
    if (contextTab !== "settings" || contextMode !== "agent") return;
    if (settingsAgent) return;
    setContextTab("tasks");
  }, [contextMode, contextTab, settingsAgent]);

  // Model loading is handled by useGatewayModels hook

  const loadSummarySnapshot = useCallback(async () => {
    const activeAgents = stateRef.current.agents.filter((agent) => agent.sessionCreated);
    const sessionKeys = Array.from(
      new Set(
        activeAgents
          .map((agent) => agent.sessionKey)
          .filter((key): key is string => typeof key === "string" && key.trim().length > 0)
      )
    ).slice(0, 64);
    if (sessionKeys.length === 0) return;
    try {
      const [statusSummary, previewResult] = await Promise.all([
        client.call<SummaryStatusSnapshot>("status", {}),
        client.call<SummaryPreviewSnapshot>("sessions.preview", {
          keys: sessionKeys,
          limit: 8,
          maxChars: 240,
        }),
      ]);
      for (const entry of buildSummarySnapshotPatches({
        agents: activeAgents,
        statusSummary,
        previewResult,
      })) {
        dispatch({
          type: "updateAgent",
          agentId: entry.agentId,
          patch: entry.patch,
        });
      }
    } catch (err) {
      if (!isGatewayDisconnectLikeError(err)) {
        console.error("Failed to load summary snapshot.", err);
      }
    }
  }, [client, dispatch]);

  loadSummarySnapshotRef.current = loadSummarySnapshot;

  useEffect(() => {
    if (status !== "connected") return;
    void loadSummarySnapshotRef.current();
  }, [status]);

  // Poll summary every 10s when any agent is running.
  // Use refs for `hasRunningAgents` and `loadSummarySnapshot` so the interval
  // is only created/destroyed when `status` changes (not on every running toggle).
  const hasRunningAgentsRef = useRef(hasRunningAgents);
  hasRunningAgentsRef.current = hasRunningAgents;
  useEffect(() => {
    if (status !== "connected") return;
    const interval = setInterval(() => {
      if (!hasRunningAgentsRef.current) return;
      void loadSummarySnapshotRef.current();
    }, 10_000);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (!state.selectedAgentId) return;
    if (agents.some((agent) => agent.agentId === state.selectedAgentId)) return;
    dispatch({ type: "selectAgent", agentId: null });
  }, [agents, dispatch, state.selectedAgentId]);

  useEffect(() => {
    const nextId = focusedAgent?.agentId ?? null;
    if (state.selectedAgentId === nextId) return;
    dispatch({ type: "selectAgent", agentId: nextId });
  }, [dispatch, focusedAgent, state.selectedAgentId]);

  const handleOpenAgentSettings = useCallback(
    (agentId: string) => {
      flushPendingDraft(focusedAgent?.agentId ?? null);
      setSettingsAgentId(agentId);
      setContextMode("agent");
      setContextTab("settings");
      setMobilePane("context");
      dispatch({ type: "selectAgent", agentId });
    },
    [dispatch, flushPendingDraft, focusedAgent, setSettingsAgentId]
  );

  const handleFilesToggle = useCallback(() => {
    setContextMode((prev) => {
      if (prev === "files") {
        setMobilePane("chat");
        return "agent";
      }
      setMobilePane("context");
      return "files";
    });
  }, []);

  const handleNewSession = useCallback(
    async (agentId: string) => {
      const agent = agents.find((entry) => entry.agentId === agentId);
      if (!agent) {
        setError("Failed to start new session: agent not found.");
        return;
      }
      try {
        const sessionKey = agent.sessionKey.trim();
        if (!sessionKey) {
          throw new Error("Missing session key for agent.");
        }
        await client.call("sessions.reset", { key: sessionKey });
        const patch = buildNewSessionAgentPatch(agent);
        runtimeEventHandlerRef.current?.clearRunTracking(agent.runId);
        historyInFlightRef.current.delete(sessionKey);
        specialUpdateRef.current.delete(agentId);
        specialUpdateInFlightRef.current.delete(agentId);
        dispatch({
          type: "updateAgent",
          agentId,
          patch,
        });
        setSettingsAgentId(null);
        setMobilePane("chat");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to start new session.";
        setError(message);
        dispatch({
          type: "appendOutput",
          agentId,
          line: `New session failed: ${message}`,
        });
      }
    },
    [agents, client, dispatch, historyInFlightRef, setError, setSettingsAgentId, specialUpdateInFlightRef, specialUpdateRef]
  );

  const handleSend = useCallback(
    async (agentId: string, sessionKey: string, message: string) => {
      const trimmed = message.trim();
      if (!trimmed) return;
      const pendingDraftTimer = pendingDraftTimersRef.current.get(agentId) ?? null;
      if (pendingDraftTimer !== null) {
        window.clearTimeout(pendingDraftTimer);
        pendingDraftTimersRef.current.delete(agentId);
      }
      pendingDraftValuesRef.current.delete(agentId);
      const isResetCommand = /^\/(reset|new)(\s|$)/i.test(trimmed);
      const runId = crypto.randomUUID();
      runtimeEventHandlerRef.current?.clearRunTracking(runId);
      const agent = stateRef.current.agents.find((entry) => entry.agentId === agentId);
      if (!agent) {
        dispatch({
          type: "appendOutput",
          agentId,
          line: "Error: Agent not found.",
        });
        return;
      }
      if (isResetCommand) {
        dispatch({
          type: "updateAgent",
          agentId,
          patch: { outputLines: [], streamText: null, thinkingTrace: null, lastResult: null },
        });
      }
      dispatch({
        type: "updateAgent",
        agentId,
        patch: {
          status: "running",
          runId,
          streamText: "",
          thinkingTrace: null,
          draft: "",
          lastUserMessage: trimmed,
          lastActivityAt: Date.now(),
        },
      });
      dispatch({
        type: "appendOutput",
        agentId,
        line: `> ${trimmed}`,
      });
      try {
        if (!sessionKey) {
          throw new Error("Missing session key for agent.");
        }
        let createdSession = agent.sessionCreated;
        if (!agent.sessionSettingsSynced) {
          await syncGatewaySessionSettings({
            client,
            sessionKey,
            model: agent.model ?? null,
            thinkingLevel: agent.thinkingLevel ?? null,
          });
          createdSession = true;
          dispatch({
            type: "updateAgent",
            agentId,
            patch: { sessionSettingsSynced: true, sessionCreated: true },
          });
        }
        await client.call("chat.send", {
          sessionKey,
          message: buildAgentInstruction({ message: trimmed }),
          deliver: false,
          idempotencyKey: runId,
        });
        if (!createdSession) {
          dispatch({
            type: "updateAgent",
            agentId,
            patch: { sessionCreated: true },
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Gateway error";
        dispatch({
          type: "updateAgent",
          agentId,
          patch: { status: "error", runId: null, streamText: null, thinkingTrace: null },
        });
        dispatch({
          type: "appendOutput",
          agentId,
          line: `Error: ${msg}`,
        });
      }
    },
    [client, dispatch, pendingDraftTimersRef, pendingDraftValuesRef]
  );

  const handleCompact = useCallback(async () => {
    if (!focusedAgent || !client || isCompacting) return;
    setIsCompacting(true);
    try {
      await client.call("chat.send", {
        sessionKey: focusedAgent.sessionKey,
        message: "/compact",
        deliver: false,
      });
      setLastCompactedAt(Date.now());
    } catch (err) {
      console.error("Compact failed:", err);
    } finally {
      setIsCompacting(false);
    }
  }, [focusedAgent, client, isCompacting]);

  const handleStopRun = useCallback(
    async (agentId: string, sessionKey: string) => {
      if (status !== "connected") {
        setError("Connect to gateway before stopping a run.");
        return;
      }
      const resolvedSessionKey = sessionKey.trim();
      if (!resolvedSessionKey) {
        setError("Missing session key for agent.");
        return;
      }
      if (stopBusyAgentId === agentId) {
        return;
      }
      setStopBusyAgentId(agentId);
      try {
        await client.call("chat.abort", {
          sessionKey: resolvedSessionKey,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to stop run.";
        setError(message);
        console.error(message);
        dispatch({
          type: "appendOutput",
          agentId,
          line: `Stop failed: ${message}`,
        });
      } finally {
        setStopBusyAgentId((current) => (current === agentId ? null : current));
      }
    },
    [client, dispatch, setError, status, stopBusyAgentId]
  );

  const handleSessionSettingChange = useCallback(
    async (
      agentId: string,
      sessionKey: string,
      field: "model" | "thinkingLevel",
      value: string | null
    ) => {
      await applySessionSettingMutation({
        agents: stateRef.current.agents,
        dispatch,
        client,
        agentId,
        sessionKey,
        field,
        value,
      });
    },
    [client, dispatch]
  );

  const handleModelChange = useCallback(
    async (agentId: string, sessionKey: string, value: string | null) => {
      await handleSessionSettingChange(agentId, sessionKey, "model", value);
    },
    [handleSessionSettingChange]
  );

  const handleThinkingChange = useCallback(
    async (agentId: string, sessionKey: string, value: string | null) => {
      await handleSessionSettingChange(agentId, sessionKey, "thinkingLevel", value);
    },
    [handleSessionSettingChange]
  );

  const handleToolCallingToggle = useCallback(
    (agentId: string, enabled: boolean) => {
      dispatch({
        type: "updateAgent",
        agentId,
        patch: { toolCallingEnabled: enabled },
      });
    },
    [dispatch]
  );

  const handleThinkingTracesToggle = useCallback(
    (agentId: string, enabled: boolean) => {
      dispatch({
        type: "updateAgent",
        agentId,
        patch: { showThinkingTraces: enabled },
      });
    },
    [dispatch]
  );

  useEffect(() => {
    const handler = createGatewayRuntimeEventHandler({
      getStatus: () => status,
      getAgents: () => stateRef.current.agents,
      dispatch,
      queueLivePatch,
      clearPendingLivePatch,
      loadSummarySnapshot: () => loadSummarySnapshotRef.current(),
      loadAgentHistory: (agentId: string) => loadAgentHistoryRef.current(agentId),
      refreshHeartbeatLatestUpdate: () => refreshHeartbeatLatestUpdateRef.current(),
      bumpHeartbeatTick,
      setTimeout: (fn, delayMs) => window.setTimeout(fn, delayMs),
      clearTimeout: (id) => window.clearTimeout(id),
      isDisconnectLikeError: isGatewayDisconnectLikeError,
      logWarn: (message, meta) => console.warn(message, meta),
      updateSpecialLatestUpdate: (agentId, agent, message) => {
        void updateSpecialLatestUpdate(agentId, agent, message);
      },
      onExecApprovalRequested: (payload) => {
        const parsed = parseExecApprovalRequested(payload);
        if (parsed) {
          setExecApprovalQueue((prev) => pruneExpired([...prev, parsed]));
        }
      },
      onExecApprovalResolved: (payload) => {
        const parsed = parseExecApprovalResolved(payload);
        if (parsed) {
          setExecApprovalQueue((prev) => prev.filter((r) => r.id !== parsed.id));
        }
      },
      onChannelsUpdate: () => {
        void loadChannelsStatusRef.current();
      },
      onSessionsUpdate: () => {
        void loadAllSessionsRef.current();
      },
      onCronUpdate: () => {
        void loadAllCronJobsRef.current();
      },
      onSubAgentLifecycle: (sessionKey: string, phase: string) => {
        if (phase === "start") {
          setSubAgentRunningKeys(prev => { const next = new Set(prev); next.add(sessionKey); return next; });
        } else if (phase === "end" || phase === "error") {
          setSubAgentRunningKeys(prev => { const next = new Set(prev); next.delete(sessionKey); return next; });
        }
      },
    });
    runtimeEventHandlerRef.current = handler;
    const unsubscribe = client.onEvent((event: EventFrame) => handler.handleEvent(event));
    return () => {
      runtimeEventHandlerRef.current = null;
      handler.dispose();
      unsubscribe();
      if (sessionsUpdateTimerRef.current) {
        clearTimeout(sessionsUpdateTimerRef.current);
        sessionsUpdateTimerRef.current = null;
      }
      if (cronUpdateTimerRef.current) {
        clearTimeout(cronUpdateTimerRef.current);
        cronUpdateTimerRef.current = null;
      }
    };
  }, [
    bumpHeartbeatTick,
    clearPendingLivePatch,
    client,
    dispatch,
    queueLivePatch,
    setExecApprovalQueue,
    status,
    updateSpecialLatestUpdate,
  ]);

  const handleAvatarShuffle = useCallback(
    async (agentId: string) => {
      const avatarSeed = crypto.randomUUID();
      dispatch({
        type: "updateAgent",
        agentId,
        patch: { avatarSeed },
      });
      const key = gatewayUrl.trim();
      if (!key) return;
      settingsCoordinator.schedulePatch(
        {
          avatars: {
            [key]: {
              [agentId]: avatarSeed,
            },
          },
        },
        0
      );
    },
    [dispatch, gatewayUrl, settingsCoordinator]
  );

  const connectionPanelVisible = showConnectionPanel;
  const hasAnyAgents = agents.length > 0;
  const showFleetLayout = hasAnyAgents || status === "connected";
  const configMutationStatusLine = activeConfigMutation
    ? `Applying config change: ${activeConfigMutation.label}`
    : queuedConfigMutationCount > 0
      ? hasRunningAgents
        ? `Queued ${queuedConfigMutationCount} config change${queuedConfigMutationCount === 1 ? "" : "s"}; waiting for ${runningAgentCount} running agent${runningAgentCount === 1 ? "" : "s"} to finish`
        : status !== "connected"
          ? `Queued ${queuedConfigMutationCount} config change${queuedConfigMutationCount === 1 ? "" : "s"}; waiting for gateway connection`
          : `Queued ${queuedConfigMutationCount} config change${queuedConfigMutationCount === 1 ? "" : "s"}`
      : null;
  const createBlockStatusLine = createAgentBlock
    ? createAgentBlock.phase === "queued"
      ? "Waiting for active runs to finish"
      : createAgentBlock.phase === "creating"
      ? "Submitting config change"
      : createAgentBlock.phase === "bootstrapping-files"
        ? "Bootstrapping brain files"
      : !createAgentBlock.sawDisconnect
        ? "Waiting for gateway to restart"
        : status === "connected"
          ? "Gateway is back online, syncing agents"
          : "Gateway restart in progress"
    : null;
  const renameBlockStatusLine = renameAgentBlock
    ? renameAgentBlock.phase === "queued"
      ? "Waiting for active runs to finish"
      : renameAgentBlock.phase === "renaming"
      ? "Submitting config change"
      : !renameAgentBlock.sawDisconnect
        ? "Waiting for gateway to restart"
        : status === "connected"
          ? "Gateway is back online, syncing agents"
          : "Gateway restart in progress"
    : null;
  const deleteBlockStatusLine = deleteAgentBlock
    ? deleteAgentBlock.phase === "queued"
      ? "Waiting for active runs to finish"
      : deleteAgentBlock.phase === "deleting"
      ? "Submitting config change"
      : !deleteAgentBlock.sawDisconnect
        ? "Waiting for gateway to restart"
        : status === "connected"
          ? "Gateway is back online, syncing agents"
          : "Gateway restart in progress"
      : null;

  // ── Stable callbacks for AgentChatPanel (avoid inline arrows that defeat memo) ──
  const stableChatOnOpenSettings = useCallback(() => {
    const fa = focusedAgentRef.current;
    if (fa) handleOpenAgentSettings(fa.agentId);
  }, [handleOpenAgentSettings]);

  const stableChatOnModelChange = useCallback((value: string | null) => {
    const fa = focusedAgentRef.current;
    if (fa) handleModelChange(fa.agentId, fa.sessionKey, value);
  }, [handleModelChange]);

  const stableChatOnThinkingChange = useCallback((value: string | null) => {
    const fa = focusedAgentRef.current;
    if (fa) handleThinkingChange(fa.agentId, fa.sessionKey, value);
  }, [handleThinkingChange]);

  const stableChatOnDraftChange = useCallback((value: string) => {
    const fa = focusedAgentRef.current;
    if (fa) handleDraftChange(fa.agentId, value);
  }, [handleDraftChange]);

  const stableChatOnSend = useCallback((message: string) => {
    const fa = focusedAgentRef.current;
    if (fa) {
      setViewingSessionKey(null);
      handleSend(fa.agentId, fa.sessionKey, message);
    }
  }, [handleSend]);

  const stableChatOnStopRun = useCallback(() => {
    const fa = focusedAgentRef.current;
    if (fa) handleStopRun(fa.agentId, fa.sessionKey);
  }, [handleStopRun]);

  const stableChatOnAvatarShuffle = useCallback(() => {
    const fa = focusedAgentRef.current;
    if (fa) handleAvatarShuffle(fa.agentId);
  }, [handleAvatarShuffle]);

  const stableChatOnNewSession = useCallback(() => {
    const fa = focusedAgentRef.current;
    if (fa) handleNewSession(fa.agentId);
  }, [handleNewSession]);

  const stableChatOnExitSessionView = useCallback(() => {
    setViewingSessionKey(null);
  }, []);

  const stableChatTokenUsed = useMemo(() => {
    if (!focusedAgent) return undefined;
    const cw = agentContextWindow.get(focusedAgent.agentId);
    if (cw && cw.totalTokens > 0) return cw.totalTokens;
    return sessionUsage ? sessionUsage.inputTokens + sessionUsage.outputTokens : undefined;
  }, [focusedAgent, agentContextWindow, sessionUsage]);

  const stableChatTokenLimit = useMemo(() => {
    if (!focusedAgent) return undefined;
    const cw = agentContextWindow.get(focusedAgent.agentId);
    if (cw && cw.contextTokens > 0) return cw.contextTokens;
    return findModelMatch(focusedAgent.model)?.contextWindow;
  }, [focusedAgent, agentContextWindow, findModelMatch]);

  if (status === "connecting" || (status === "connected" && !agentsLoadedOnce)) {
    return (
      <div className="relative w-screen overflow-hidden bg-background" style={{ minHeight: '100dvh' }}>
        <div className="flex items-center justify-center px-6" style={{ minHeight: '100dvh' }}>
          <div className="glass-panel w-full max-w-md px-6 py-8 flex flex-col items-center gap-4">
            <BrandMark size="lg" />
            <div className="text-sm text-muted-foreground">
              {status === "connecting" ? "Connecting to gateway…" : "Loading agents…"}
            </div>
            <div className="typing-dots mt-1">
              <span /><span /><span />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen overflow-hidden bg-background" style={{ minHeight: '100dvh' }}>
      {state.loading ? (
        <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-50 flex justify-center px-3">
          <div className="glass-panel px-6 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Loading agents…
          </div>
        </div>
      ) : null}
      <div className="relative z-10 flex flex-col gap-4 px-3 py-3 sm:px-4 sm:py-4 md:px-6 md:py-6" style={{ height: '100dvh' }}>
        <div className="w-full">
          <HeaderBar
            status={status}
            onConnectionSettings={() => setShowConnectionPanel((prev) => !prev)}
            onFilesToggle={handleFilesToggle}
            filesActive={contextMode === "files"}
            filesDisabled={false}
            channelsSnapshot={channelsSnapshot}
            channelsLoading={channelsLoading}
            onOpenFleet={() => setMobilePane("fleet")}
            onOpenContext={() => setMobilePane("context")}
          />
        </div>

        {connectionPanelVisible ? (
          <div className="w-full">
            <div className="glass-panel px-4 py-4 sm:px-6 sm:py-6">
              <ConnectionPanel
                gatewayUrl={gatewayUrl}
                token={token}
                status={status}
                error={gatewayError}
                onGatewayUrlChange={setGatewayUrl}
                onTokenChange={setToken}
                onConnect={() => void connect()}
                onDisconnect={disconnect}
              />
            </div>
          </div>
        ) : null}

        {errorMessage ? (
          <div className="w-full">
            <div className="rounded-md border border-destructive bg-destructive px-4 py-2 text-sm text-destructive-foreground">
              {errorMessage}
            </div>
          </div>
        ) : null}
        {configMutationStatusLine ? (
          <div className="w-full">
            <div className="rounded-md border border-border/80 bg-card/80 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.11em] text-muted-foreground">
              {configMutationStatusLine}
            </div>
          </div>
        ) : null}

        {showFleetLayout ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 xl:flex-row">
            {/* Backdrop for mobile drawers */}
            {mobilePane !== "chat" ? (
              <div
                className="fixed inset-0 z-40 bg-black/50 xl:hidden"
                onClick={() => setMobilePane("chat")}
              />
            ) : null}
            <div
              className={`fixed inset-y-0 left-0 z-50 w-[280px] transform transition-transform duration-300 xl:static xl:flex xl:flex-[0_0_auto] xl:min-h-0 xl:w-[280px] xl:translate-x-0 ${mobilePane === "fleet" ? "translate-x-0" : "-translate-x-full"}`}
            >
              <FleetSidebar
                agents={filteredAgents}
                selectedAgentId={focusedAgent?.agentId ?? state.selectedAgentId}
                filter={focusFilter}
                onFilterChange={handleFocusFilterChange}
                onCreateAgent={() => {
                  void handleCreateAgent();
                }}
                createDisabled={status !== "connected" || createAgentBusy || state.loading}
                createBusy={createAgentBusy}
                onSelectAgent={(agentId) => {
                  flushPendingDraft(focusedAgent?.agentId ?? null);
                  dispatch({ type: "selectAgent", agentId });
                  setMobilePane("chat");
                }}
                presenceAgentIds={presenceAgentIds}
                subAgentSessions={subAgentSessions}
                agentTokenInfo={agentTokenInfo}
              />
            </div>
            <div
              className="glass-panel flex min-h-0 flex-1 overflow-hidden p-2 sm:p-3"
              data-testid="focused-agent-panel"
            >
              {focusedAgent ? (
                <AgentChatPanel
                  agent={focusedAgent}
                  isSelected={false}
                  canSend={status === "connected"}
                  models={gatewayModels}
                  stopBusy={stopBusyAgentId === focusedAgent.agentId}
                  onOpenSettings={stableChatOnOpenSettings}
                  onModelChange={stableChatOnModelChange}
                  onThinkingChange={stableChatOnThinkingChange}
                  onDraftChange={stableChatOnDraftChange}
                  onSend={stableChatOnSend}
                  onStopRun={stableChatOnStopRun}
                  onAvatarShuffle={stableChatOnAvatarShuffle}
                  onNewSession={stableChatOnNewSession}
                  onCompact={handleCompact}
                  isCompacting={isCompacting}
                  lastCompactedAt={lastCompactedAt}
                  tokenUsed={stableChatTokenUsed}
                  tokenLimit={stableChatTokenLimit}
                  viewingSessionKey={viewingSessionKey}
                  viewingSessionHistory={viewingSessionHistory}
                  viewingSessionLoading={viewingSessionLoading}
                  onExitSessionView={stableChatOnExitSessionView}
                />
              ) : (
                <EmptyStatePanel
                  title={hasAnyAgents ? "No agents match this filter." : "No agents available."}
                  description={
                    hasAnyAgents
                      ? undefined
                      : "Use New Agent in the sidebar to add your first agent."
                  }
                  fillHeight
                  className="items-center p-6 text-center text-sm"
                />
              )}
            </div>
            {/* Context Panel: agent-scoped (Tasks/Brain/Settings) or global (Files) */}
            <div
              className={`fixed inset-y-0 right-0 z-50 w-[360px] transform transition-transform duration-300 xl:static xl:flex xl:shrink-0 xl:flex-none xl:w-[360px] xl:translate-x-0 ${mobilePane === "context" ? "translate-x-0" : "translate-x-full"} glass-panel min-h-0 overflow-hidden p-0`}
            >
              {contextMode === "files" ? (
                <ArtifactsPanel isSelected />
              ) : (
                <ContextPanel
                  activeTab={contextTab}
                  onTabChange={(tab) => {
                    setContextTab(tab);
                    if (tab === "settings" && focusedAgent && !settingsAgentId) {
                      setSettingsAgentId(focusedAgent.agentId);
                    }
                  }}
                  tasksContent={<TasksPanel isSelected />}
                  brainContent={
                    <AgentBrainPanel
                      client={client}
                      agents={agents}
                      selectedAgentId={selectedBrainAgentId}
                      onClose={() => {
                        setContextMode("agent");
                        setMobilePane("chat");
                      }}
                    />
                  }
                  channelsContent={
                    <ChannelsPanel
                      snapshot={channelsSnapshot}
                      loading={channelsLoading}
                      error={channelsError}
                      onRefresh={() => {
                        void loadChannelsStatus();
                      }}
                    />
                  }
                  sessionsContent={
                    <SessionsPanel
                      client={client}
                      sessions={allSessions}
                      loading={allSessionsLoading}
                      error={allSessionsError}
                      onRefresh={() => {
                        void loadAllSessions();
                        void loadCumulativeUsage();
                      }}
                      activeSessionKey={focusedAgent?.sessionKey ?? null}
                      aggregateUsage={aggregateUsage}
                      aggregateUsageLoading={aggregateUsageLoading}
                      cumulativeUsage={cumulativeUsage && (cumulativeUsage.inputTokens + cumulativeUsage.outputTokens) > 0 ? {
                        inputTokens: cumulativeUsage.inputTokens,
                        outputTokens: cumulativeUsage.outputTokens,
                        totalCost: cumulativeUsage.totalCost,
                        messageCount: cumulativeUsage.messageCount,
                      } : aggregateTokensFromList ? {
                        inputTokens: aggregateTokensFromList.inputTokens,
                        outputTokens: aggregateTokensFromList.outputTokens,
                        totalCost: null,
                        messageCount: 0,
                      } : null}
                      cumulativeUsageLoading={cumulativeUsageLoading}
                      onSessionClick={(sessionKey, agentId) => {
                        if (agentId) {
                          flushPendingDraft(focusedAgent?.agentId ?? null);
                          dispatch({ type: "selectAgent", agentId });
                          setMobilePane("chat");
                        }
                        // Load session history
                        setViewingSessionKey(sessionKey);
                        setViewingSessionLoading(true);
                        setViewingSessionHistory([]);
                        client.call<{ messages?: Array<{ role?: string; content?: string; text?: string }> }>("sessions.history", { sessionKey, limit: 50 })
                          .then((result) => {
                            const lines: string[] = [];
                            for (const msg of result.messages ?? []) {
                              const text = msg.text ?? msg.content ?? "";
                              if (!text) continue;
                              if (msg.role === "user") {
                                lines.push(`> ${text}`);
                              } else {
                                lines.push(text);
                              }
                            }
                            setViewingSessionHistory(lines);
                          })
                          .catch((err) => {
                            console.error("Failed to load session history:", err);
                            setViewingSessionHistory([`Error loading session history: ${err instanceof Error ? err.message : "Unknown error"}`]);
                          })
                          .finally(() => setViewingSessionLoading(false));
                      }}
                    />
                  }
                  cronContent={
                    <CronPanel
                      client={client}
                      cronJobs={allCronJobs}
                      loading={allCronLoading}
                      error={allCronError}
                      runBusyJobId={allCronRunBusyJobId}
                      deleteBusyJobId={allCronDeleteBusyJobId}
                      onRunJob={(jobId) => {
                        void handleAllCronRunJob(jobId);
                      }}
                      onDeleteJob={(jobId) => {
                        void handleAllCronDeleteJob(jobId);
                      }}
                      onRefresh={() => {
                        void loadAllCronJobs();
                      }}
                    />
                  }
                  settingsContent={
                    settingsAgent ? (
                      <AgentSettingsPanel
                        key={settingsAgent.agentId}
                        agent={settingsAgent}
                        onClose={() => {
                          setSettingsAgentId(null);
                          setContextTab("tasks");
                        }}
                        onRename={(name) => handleRenameAgent(settingsAgent.agentId, name)}
                        onNewSession={() => handleNewSession(settingsAgent.agentId)}
                        onDelete={() => handleDeleteAgent(settingsAgent.agentId)}
                        canDelete={settingsAgent.agentId !== RESERVED_MAIN_AGENT_ID}
                        onToolCallingToggle={(enabled) =>
                          handleToolCallingToggle(settingsAgent.agentId, enabled)
                        }
                        onThinkingTracesToggle={(enabled) =>
                          handleThinkingTracesToggle(settingsAgent.agentId, enabled)
                        }
                        cronJobs={settingsCronJobs}
                        cronLoading={settingsCronLoading}
                        cronError={settingsCronError}
                        cronRunBusyJobId={cronRunBusyJobId}
                        cronDeleteBusyJobId={cronDeleteBusyJobId}
                        onRunCronJob={(jobId) => handleRunCronJob(settingsAgent.agentId, jobId)}
                        onDeleteCronJob={(jobId) => handleDeleteCronJob(settingsAgent.agentId, jobId)}
                        heartbeats={settingsHeartbeats}
                        heartbeatLoading={settingsHeartbeatLoading}
                        heartbeatError={settingsHeartbeatError}
                        heartbeatRunBusyId={heartbeatRunBusyId}
                        heartbeatDeleteBusyId={heartbeatDeleteBusyId}
                        onRunHeartbeat={(heartbeatId) =>
                          handleRunHeartbeat(settingsAgent.agentId, heartbeatId)
                        }
                        onDeleteHeartbeat={(heartbeatId) =>
                          handleDeleteHeartbeat(settingsAgent.agentId, heartbeatId)
                        }
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-6 text-center text-[11px] text-muted-foreground">
                        Select an agent to view settings.
                      </div>
                    )
                  }
                />
              )}
            </div>
          </div>
        ) : (
          <div className="glass-panel fade-up-delay flex min-h-0 flex-1 flex-col overflow-hidden p-5 sm:p-6">
            <EmptyStatePanel
              label="Fleet"
              title="No agents available"
              description="Connect to your gateway to load agents into the studio."
              detail={gatewayUrl || "Gateway URL is empty"}
              fillHeight
              className="items-center px-6 py-10 text-center"
            />
          </div>
	        )}
        {showFleetLayout ? (
          <div className="w-full">
            <StatusBar
              gatewayVersion={gatewayVersion}
              gatewayUptime={gatewayUptime}
              agentCount={agents.length}
              sessionCount={totalSessionCount}
              channelCount={connectedChannelCount}
              totalChannelCount={totalChannelCount}
              visible={status === "connected"}
            />
          </div>
        ) : null}
	      </div>
      {execApprovalQueue.length > 0 ? (
        <ExecApprovalOverlay
          queue={execApprovalQueue}
          busy={execApprovalBusy}
          error={execApprovalError}
          onDecision={(id, decision) => {
            void handleExecApprovalDecision(id, decision);
          }}
        />
      ) : null}
      <ConfigMutationModals
        createAgentBlock={createAgentBlock}
        createBlockStatusLine={createBlockStatusLine}
        renameAgentBlock={renameAgentBlock}
        renameBlockStatusLine={renameBlockStatusLine}
        deleteAgentBlock={deleteAgentBlock}
        deleteBlockStatusLine={deleteBlockStatusLine}
        deleteConfirmAgentId={deleteConfirmAgentId}
        agents={agents}
        onCancelDelete={() => setDeleteConfirmAgentId(null)}
        onConfirmDelete={(agentId) => { setDeleteConfirmAgentId(null); void handleConfirmDeleteAgent(agentId); }}
      />
    </div>
  );
};

export default function Home() {
  return (
    <AgentStoreProvider>
      <AgentStudioPage />
    </AgentStoreProvider>
  );
}
