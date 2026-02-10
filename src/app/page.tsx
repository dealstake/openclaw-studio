"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";
import {
  AgentBrainPanel,
  AgentSettingsPanel,
} from "@/features/agents/components/AgentInspectPanels";
import { FleetSidebar } from "@/features/agents/components/FleetSidebar";
import { HeaderBar } from "@/features/agents/components/HeaderBar";
import { ConnectionPanel } from "@/features/agents/components/ConnectionPanel";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
import { BrandMark } from "@/components/brand/BrandMark";
import {
  buildAgentInstruction,
} from "@/lib/text/message-extract";
import { useGatewayConnection } from "@/lib/gateway/GatewayClient";
import {
  buildGatewayModelChoices,
  type GatewayModelChoice,
  type GatewayModelPolicySnapshot,
  resolveConfiguredModelKey,
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
import type { AgentStoreSeed, AgentState } from "@/features/agents/state/store";
import { createGatewayRuntimeEventHandler } from "@/features/agents/state/gatewayRuntimeEventHandler";
import {
  type CronJobSummary,
  filterCronJobsForAgent,
  listCronJobs,
  removeCronJob,
  runCronJobNow,
} from "@/lib/cron/types";
import {
  removeGatewayHeartbeatOverride,
  listHeartbeatsForAgent,
  triggerHeartbeatNow,
  type AgentHeartbeatSummary,
} from "@/lib/gateway/agentConfig";
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
import { useSessionUsage } from "@/features/sessions/hooks/useSessionUsage";
import { useGatewayStatus } from "@/features/status/hooks/useGatewayStatus";
import { ConfigMutationModals } from "@/features/agents/components/ConfigMutationModals";
import { MobilePaneToggle, type MobilePane } from "@/features/agents/components/MobilePaneToggle";
import { useConfigMutationQueue } from "@/features/agents/hooks/useConfigMutationQueue";
import { useDraftBatching } from "@/features/agents/hooks/useDraftBatching";
import { useLivePatchBatching } from "@/features/agents/hooks/useLivePatchBatching";
import { useSpecialUpdates } from "@/features/agents/hooks/useSpecialUpdates";
import { useAgentHistorySync } from "@/features/agents/hooks/useAgentHistorySync";
import { useAgentLifecycle } from "@/features/agents/hooks/useAgentLifecycle";

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
};

type SessionsListResult = {
  sessions?: SessionsListEntry[];
};

const RESERVED_MAIN_AGENT_ID = "main";

const sortCronJobsByUpdatedAt = (jobs: CronJobSummary[]) =>
  [...jobs].sort((a, b) => b.updatedAtMs - a.updatedAtMs);

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
  const [gatewayModels, setGatewayModels] = useState<GatewayModelChoice[]>([]);
  const [gatewayModelsError, setGatewayModelsError] = useState<string | null>(null);
  const [gatewayConfigSnapshot, setGatewayConfigSnapshot] =
    useState<GatewayModelPolicySnapshot | null>(null);
  const [stopBusyAgentId, setStopBusyAgentId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("chat");
  const [settingsAgentId, setSettingsAgentId] = useState<string | null>(null);
  const [settingsCronJobs, setSettingsCronJobs] = useState<CronJobSummary[]>([]);
  const [settingsCronLoading, setSettingsCronLoading] = useState(false);
  const [settingsCronError, setSettingsCronError] = useState<string | null>(null);
  const [cronRunBusyJobId, setCronRunBusyJobId] = useState<string | null>(null);
  const [cronDeleteBusyJobId, setCronDeleteBusyJobId] = useState<string | null>(null);
  const [settingsHeartbeats, setSettingsHeartbeats] = useState<AgentHeartbeatSummary[]>([]);
  const [settingsHeartbeatLoading, setSettingsHeartbeatLoading] = useState(false);
  const [settingsHeartbeatError, setSettingsHeartbeatError] = useState<string | null>(null);
  const [heartbeatRunBusyId, setHeartbeatRunBusyId] = useState<string | null>(null);
  const [heartbeatDeleteBusyId, setHeartbeatDeleteBusyId] = useState<string | null>(null);
  /** "agent" = show ContextPanel (Tasks/Brain/Settings), "files" = show Files, null = hidden on desktop */
  const [contextMode, setContextMode] = useState<"agent" | "files" | null>(null);
  const [contextTab, setContextTab] = useState<ContextTab>("settings");
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
    allSessions, allSessionsLoading, allSessionsError,
    totalSessionCount, loadAllSessions,
  } = useAllSessions(client, status);

  const {
    allCronJobs, allCronLoading, allCronError,
    allCronRunBusyJobId, allCronDeleteBusyJobId,
    loadAllCronJobs, handleAllCronRunJob, handleAllCronDeleteJob,
  } = useAllCronJobs(client, status);

  const { flushPendingDraft, handleDraftChange, pendingDraftValuesRef, pendingDraftTimersRef } =
    useDraftBatching(dispatch);

  const { queueLivePatch } = useLivePatchBatching(dispatch);

  const agents = state.agents;
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
  const focusedAgentRunning = focusedAgent?.status === "running";
  const settingsAgent = useMemo(() => {
    if (!settingsAgentId) return null;
    return agents.find((entry) => entry.agentId === settingsAgentId) ?? null;
  }, [agents, settingsAgentId]);
  const selectedBrainAgentId = useMemo(() => {
    return focusedAgent?.agentId ?? agents[0]?.agentId ?? null;
  }, [agents, focusedAgent]);
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
      return;
    }
    void loadChannelsStatus();
    void loadGatewayStatus();
    void parsePresenceFromStatus();
    void loadAllSessions();
    void loadAllCronJobs();
  }, [loadChannelsStatus, loadGatewayStatus, parsePresenceFromStatus, loadAllSessions, loadAllCronJobs, status]);

  // ── Load session usage when settings agent changes ──────────────
  useEffect(() => {
    if (!settingsAgent) {
      resetSessionUsage();
      return;
    }
    void loadSessionUsage(settingsAgent.sessionKey);
  }, [settingsAgent, loadSessionUsage]);

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

  const loadCronJobsForSettingsAgent = useCallback(
    async (agentId: string) => {
      const resolvedAgentId = agentId.trim();
      if (!resolvedAgentId) {
        setSettingsCronJobs([]);
        setSettingsCronError("Failed to load cron jobs: missing agent id.");
        return;
      }
      setSettingsCronLoading(true);
      setSettingsCronError(null);
      try {
        const result = await listCronJobs(client, { includeDisabled: true });
        const filtered = filterCronJobsForAgent(result.jobs, resolvedAgentId);
        setSettingsCronJobs(sortCronJobsByUpdatedAt(filtered));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load cron jobs.";
        setSettingsCronJobs([]);
        setSettingsCronError(message);
        if (!isGatewayDisconnectLikeError(err)) {
          console.error(message);
        }
      } finally {
        setSettingsCronLoading(false);
      }
    },
    [client]
  );

  const loadHeartbeatsForSettingsAgent = useCallback(
    async (agentId: string) => {
      const resolvedAgentId = agentId.trim();
      if (!resolvedAgentId) {
        setSettingsHeartbeats([]);
        setSettingsHeartbeatError("Failed to load heartbeats: missing agent id.");
        return;
      }
      setSettingsHeartbeatLoading(true);
      setSettingsHeartbeatError(null);
      try {
        const result = await listHeartbeatsForAgent(client, resolvedAgentId);
        setSettingsHeartbeats(result.heartbeats);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load heartbeats.";
        setSettingsHeartbeats([]);
        setSettingsHeartbeatError(message);
        if (!isGatewayDisconnectLikeError(err)) {
          console.error(message);
        }
      } finally {
        setSettingsHeartbeatLoading(false);
      }
    },
    [client]
  );

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

  const resolveDefaultModelForAgent = useCallback(
    (agentId: string, snapshot: GatewayModelPolicySnapshot | null): string | null => {
      const resolvedAgentId = agentId.trim();
      if (!resolvedAgentId) return null;
      const defaults = snapshot?.config?.agents?.defaults;
      const modelAliases = defaults?.models;
      const agentEntry =
        snapshot?.config?.agents?.list?.find((entry) => entry?.id?.trim() === resolvedAgentId) ??
        null;
      const agentModel = agentEntry?.model;
      let raw: string | null = null;
      if (typeof agentModel === "string") {
        raw = agentModel;
      } else if (agentModel && typeof agentModel === "object") {
        raw = agentModel.primary ?? null;
      }
      if (!raw) {
        const defaultModel = defaults?.model;
        if (typeof defaultModel === "string") {
          raw = defaultModel;
        } else if (defaultModel && typeof defaultModel === "object") {
          raw = defaultModel.primary ?? null;
        }
      }
      if (!raw) return null;
      return resolveConfiguredModelKey(raw, modelAliases);
    },
    []
  );

  const loadAgents = useCallback(async () => {
    if (status !== "connected") return;
    setLoading(true);
    try {
      let configSnapshot = gatewayConfigSnapshot;
      if (!configSnapshot) {
        try {
          configSnapshot = await client.call<GatewayModelPolicySnapshot>("config.get", {});
          setGatewayConfigSnapshot(configSnapshot);
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
      for (const seed of seeds) {
        const mainSession = mainSessionKeyByAgent.get(seed.agentId) ?? null;
        if (!mainSession) continue;
        dispatch({
          type: "updateAgent",
          agentId: seed.agentId,
          patch: { sessionCreated: true, sessionSettingsSynced: true },
        });
      }

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
    gatewayUrl,
    gatewayConfigSnapshot,
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
    queuedConfigMutations,
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

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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
    void loadChannelsStatus();
    void loadAllSessions();
    void loadAllCronJobs();
  }, [
    createAgentBlock,
    deleteAgentBlock,
    focusedPreferencesLoaded,
    gatewayUrl,
    loadAgents,
    loadChannelsStatus,
    loadAllSessions,
    loadAllCronJobs,
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
  }, [contextTab, settingsAgentId, state.selectedAgentId]);

  useEffect(() => {
    if (settingsAgentId && !settingsAgent) {
      setSettingsAgentId(null);
    }
  }, [settingsAgentId, settingsAgent]);

  useEffect(() => {
    if (!settingsAgentId || status !== "connected") {
      setSettingsCronJobs([]);
      setSettingsCronLoading(false);
      setSettingsCronError(null);
      setCronRunBusyJobId(null);
      setCronDeleteBusyJobId(null);
      setSettingsHeartbeats([]);
      setSettingsHeartbeatLoading(false);
      setSettingsHeartbeatError(null);
      setHeartbeatRunBusyId(null);
      setHeartbeatDeleteBusyId(null);
      return;
    }
    void loadCronJobsForSettingsAgent(settingsAgentId);
    void loadHeartbeatsForSettingsAgent(settingsAgentId);
  }, [loadCronJobsForSettingsAgent, loadHeartbeatsForSettingsAgent, settingsAgentId, status]);

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

  useEffect(() => {
    if (status !== "connected") {
      setGatewayModels([]);
      setGatewayModelsError(null);
      setGatewayConfigSnapshot(null);
      return;
    }
    let cancelled = false;
    const loadModels = async () => {
      let configSnapshot: GatewayModelPolicySnapshot | null = null;
      try {
        configSnapshot = await client.call<GatewayModelPolicySnapshot>("config.get", {});
        if (!cancelled) {
          setGatewayConfigSnapshot(configSnapshot);
        }
      } catch (err) {
        if (!isGatewayDisconnectLikeError(err)) {
          console.error("Failed to load gateway config.", err);
        }
      }
      try {
        const result = await client.call<{ models: GatewayModelChoice[] }>(
          "models.list",
          {}
        );
        if (cancelled) return;
        const catalog = Array.isArray(result.models) ? result.models : [];
        setGatewayModels(buildGatewayModelChoices(catalog, configSnapshot));
        setGatewayModelsError(null);
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load models.";
        setGatewayModelsError(message);
        setGatewayModels([]);
        if (!isGatewayDisconnectLikeError(err)) {
          console.error("Failed to load gateway models.", err);
        }
      }
    };
    void loadModels();
    return () => {
      cancelled = true;
    };
  }, [client, status]);

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

  useEffect(() => {
    if (status !== "connected") return;
    void loadSummarySnapshot();
  }, [loadSummarySnapshot, status]);

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
    [dispatch, flushPendingDraft, focusedAgent]
  );

  const handleFilesToggle = useCallback(() => {
    setContextMode((prev) => {
      if (prev === "files") {
        setMobilePane("chat");
        return null;
      }
      setMobilePane("context");
      return "files";
    });
  }, []);

  const handleRunCronJob = useCallback(
    async (agentId: string, jobId: string) => {
      const resolvedJobId = jobId.trim();
      const resolvedAgentId = agentId.trim();
      if (!resolvedJobId || !resolvedAgentId) return;
      if (cronRunBusyJobId || cronDeleteBusyJobId) return;
      setCronRunBusyJobId(resolvedJobId);
      setSettingsCronError(null);
      try {
        await runCronJobNow(client, resolvedJobId);
        await loadCronJobsForSettingsAgent(resolvedAgentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to run cron job.";
        setSettingsCronError(message);
        console.error(message);
      } finally {
        setCronRunBusyJobId((current) => (current === resolvedJobId ? null : current));
      }
    },
    [client, cronDeleteBusyJobId, cronRunBusyJobId, loadCronJobsForSettingsAgent]
  );

  const handleDeleteCronJob = useCallback(
    async (agentId: string, jobId: string) => {
      const resolvedJobId = jobId.trim();
      const resolvedAgentId = agentId.trim();
      if (!resolvedJobId || !resolvedAgentId) return;
      if (cronRunBusyJobId || cronDeleteBusyJobId) return;
      setCronDeleteBusyJobId(resolvedJobId);
      setSettingsCronError(null);
      try {
        const result = await removeCronJob(client, resolvedJobId);
        if (result.ok && result.removed) {
          setSettingsCronJobs((jobs) => jobs.filter((job) => job.id !== resolvedJobId));
        }
        await loadCronJobsForSettingsAgent(resolvedAgentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete cron job.";
        setSettingsCronError(message);
        console.error(message);
      } finally {
        setCronDeleteBusyJobId((current) => (current === resolvedJobId ? null : current));
      }
    },
    [client, cronDeleteBusyJobId, cronRunBusyJobId, loadCronJobsForSettingsAgent]
  );

  const handleRunHeartbeat = useCallback(
    async (agentId: string, heartbeatId: string) => {
      const resolvedAgentId = agentId.trim();
      const resolvedHeartbeatId = heartbeatId.trim();
      if (!resolvedAgentId || !resolvedHeartbeatId) return;
      if (heartbeatRunBusyId || heartbeatDeleteBusyId) return;
      setHeartbeatRunBusyId(resolvedHeartbeatId);
      setSettingsHeartbeatError(null);
      try {
        await triggerHeartbeatNow(client, resolvedAgentId);
        await loadHeartbeatsForSettingsAgent(resolvedAgentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to trigger heartbeat.";
        setSettingsHeartbeatError(message);
        console.error(message);
      } finally {
        setHeartbeatRunBusyId((current) =>
          current === resolvedHeartbeatId ? null : current
        );
      }
    },
    [client, heartbeatDeleteBusyId, heartbeatRunBusyId, loadHeartbeatsForSettingsAgent]
  );

  const handleDeleteHeartbeat = useCallback(
    async (agentId: string, heartbeatId: string) => {
      const resolvedAgentId = agentId.trim();
      const resolvedHeartbeatId = heartbeatId.trim();
      if (!resolvedAgentId || !resolvedHeartbeatId) return;
      if (heartbeatRunBusyId || heartbeatDeleteBusyId) return;
      setHeartbeatDeleteBusyId(resolvedHeartbeatId);
      setSettingsHeartbeatError(null);
      try {
        await removeGatewayHeartbeatOverride({
          client,
          agentId: resolvedAgentId,
        });
        setSettingsHeartbeats((heartbeats) =>
          heartbeats.filter((heartbeat) => heartbeat.id !== resolvedHeartbeatId)
        );
        await loadHeartbeatsForSettingsAgent(resolvedAgentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete heartbeat.";
        setSettingsHeartbeatError(message);
        console.error(message);
      } finally {
        setHeartbeatDeleteBusyId((current) =>
          current === resolvedHeartbeatId ? null : current
        );
      }
    },
    [client, heartbeatDeleteBusyId, heartbeatRunBusyId, loadHeartbeatsForSettingsAgent]
  );

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
    [agents, client, dispatch, historyInFlightRef, setError, specialUpdateInFlightRef, specialUpdateRef]
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
      loadSummarySnapshot,
      loadAgentHistory,
      refreshHeartbeatLatestUpdate,
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
        void loadChannelsStatus();
      },
      onSessionsUpdate: () => {
        void loadAllSessions();
      },
      onCronUpdate: () => {
        void loadAllCronJobs();
      },
    });
    runtimeEventHandlerRef.current = handler;
    const unsubscribe = client.onEvent((event: EventFrame) => handler.handleEvent(event));
    return () => {
      runtimeEventHandlerRef.current = null;
      handler.dispose();
      unsubscribe();
    };
  }, [
    bumpHeartbeatTick,
    client,
    dispatch,
    loadAgentHistory,
    loadAllCronJobs,
    loadAllSessions,
    loadChannelsStatus,
    loadSummarySnapshot,
    queueLivePatch,
    refreshHeartbeatLatestUpdate,
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
            <MobilePaneToggle
              mobilePane={mobilePane}
              contextMode={contextMode}
              onPaneChange={setMobilePane}
              onEnsureContextMode={() => { if (!contextMode) setContextMode("agent"); }}
            />
            <div
              className={`${mobilePane === "fleet" ? "flex" : "hidden"} min-h-0 flex-1 xl:flex xl:flex-[0_0_auto] xl:min-h-0 xl:w-[280px]`}
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
              />
            </div>
            <div
              className={`${mobilePane === "chat" ? "flex" : "hidden"} glass-panel min-h-0 flex-1 overflow-hidden p-2 sm:p-3 xl:flex`}
              data-testid="focused-agent-panel"
            >
              {focusedAgent ? (
                <AgentChatPanel
                  agent={focusedAgent}
                  isSelected={false}
                  canSend={status === "connected"}
                  models={gatewayModels}
                  stopBusy={stopBusyAgentId === focusedAgent.agentId}
                  onOpenSettings={() => handleOpenAgentSettings(focusedAgent.agentId)}
                  onModelChange={(value) =>
                    handleModelChange(focusedAgent.agentId, focusedAgent.sessionKey, value)
                  }
                  onThinkingChange={(value) =>
                    handleThinkingChange(focusedAgent.agentId, focusedAgent.sessionKey, value)
                  }
                  onDraftChange={(value) =>
                    handleDraftChange(focusedAgent.agentId, value)
                  }
                  onSend={(message) =>
                    handleSend(
                      focusedAgent.agentId,
                      focusedAgent.sessionKey,
                      message
                    )
                  }
                  onStopRun={() =>
                    handleStopRun(focusedAgent.agentId, focusedAgent.sessionKey)
                  }
                  onAvatarShuffle={() => handleAvatarShuffle(focusedAgent.agentId)}
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
              className={`${mobilePane === "context" ? "flex" : "hidden"} glass-panel min-h-0 w-full shrink-0 overflow-hidden p-0 ${contextMode !== null ? "xl:flex xl:w-[360px]" : ""} 2xl:flex 2xl:w-[360px]`}
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
                        setContextMode(null);
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
                        usage={sessionUsage}
                        usageLoading={sessionUsageLoading}
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
