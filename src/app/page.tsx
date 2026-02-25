"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";
import type { MessagePart } from "@/lib/chat/types";
import { transformMessagesToMessageParts } from "@/features/sessions/lib/transformMessages";
import {
  AgentBrainPanel,
} from "@/features/agents/components/AgentInspectPanels";
import { SessionHistorySidebar } from "@/features/sessions/components/SessionHistorySidebar";
import { AppSidebar, type ManagementTab } from "@/layout/AppSidebar";
import type { BreadcrumbAgent } from "@/features/agents/components/AgentBreadcrumb";
import { HeaderBar } from "@/features/agents/components/HeaderBar";
import { ConnectionPanel } from "@/features/agents/components/ConnectionPanel";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
import { BrandMark } from "@/components/brand/BrandMark";
import { GatewayStatusBanner } from "@/components/GatewayStatusBanner";
import { Users } from "lucide-react";
import { sectionLabelClass } from "@/components/SectionLabel";
// buildAgentInstruction moved to useChatCallbacks
import { GatewayProvider, useGateway } from "@/lib/gateway/GatewayProvider";
import {
  type GatewayModelPolicySnapshot,
} from "@/lib/gateway/models";
import {
  AgentStoreProvider,
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
// settingsCoordinator accessed via useGateway() context
import { resolveAgentAvatarSeed, resolveFocusedPreference } from "@/lib/studio/settings";
// applySessionSettingMutation moved to useChatCallbacks
import {
  buildAgentMainSessionKey,
  isSameSessionKey,
  isGatewayDisconnectLikeError,
  type EventFrame,
} from "@/lib/gateway/GatewayClient";
import type { AgentsListResult, SessionsListEntry, SessionsListResult } from "@/lib/gateway/types";
import { ArtifactsPanel } from "@/features/artifacts/components/ArtifactsPanel";
import { TasksPanel } from "@/features/tasks/components/TasksPanel";
import { ProjectsPanel } from "@/features/projects/components/ProjectsPanel";
const TaskWizardModal = lazy(() => import("@/features/tasks/components/TaskWizardModal").then(m => ({ default: m.TaskWizardModal })));
const AgentWizardModal = lazy(() => import("@/features/agents/components/AgentWizardModal").then(m => ({ default: m.AgentWizardModal })));
import { useAgentTasks } from "@/features/tasks/hooks/useAgentTasks";
import { ContextPanel, TAB_OPTIONS } from "@/features/context/components/ContextPanel";
import type { ContextTab } from "@/features/context/components/ContextPanel";

// ContextTabCluster is now integrated into HeaderBar on wide viewports
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import { PanelExpandModal } from "@/components/PanelExpandModal";
import { ManagementPanelContent } from "@/components/ManagementPanelContent";
import { ManagementDrawer } from "@/components/ManagementDrawer";
import { ExpandedContext } from "@/features/context/lib/expandedContext";
import {
  parseExecApprovalRequested,
  parseExecApprovalResolved,
  pruneExpired,
} from "@/features/exec-approvals/types";
import { ExecApprovalProvider, useExecApprovalContext } from "@/features/exec-approvals/ExecApprovalProvider";
// SessionsPanel, CronPanel, UsagePanel, ChannelsPanel, AgentSettingsPanel moved to ManagementPanelContent
import { CommandPalette } from "@/features/command-palette/components/CommandPalette";
import { useCommandPalette } from "@/features/command-palette/hooks/useCommandPalette";
import { WorkspaceExplorerPanel } from "@/features/workspace/components/WorkspaceExplorerPanel";
import { ActivityPanel } from "@/features/activity/components/ActivityPanel";
import { appendActivityParts, finalizeActivityMessage } from "@/features/activity/hooks/useActivityMessageStore";
// Heartbeat entries now routed exclusively via onActivityMessage to useActivityMessageStore
import { TraceViewer } from "@/features/sessions/components/TraceViewer";
import { useChannelsStatus } from "@/features/channels/hooks/useChannelsStatus";
import { useAllSessions } from "@/features/sessions/hooks/useAllSessions";
import { useAllCronJobs } from "@/features/cron/hooks/useAllCronJobs";
import { EmergencyProvider } from "@/features/emergency/EmergencyProvider";
import { EmergencyOverlay } from "@/features/emergency/components/EmergencyOverlay";
import type { CronJobSummary } from "@/lib/cron/types";
import { useNotificationEvaluator } from "@/features/notifications/hooks/useNotificationEvaluator";
import { useSessionUsage } from "@/features/sessions/hooks/useSessionUsage";
import { fetchTranscriptMessages } from "@/features/sessions/hooks/useTranscripts";
import { useGatewayStatus } from "@/lib/gateway/useGatewayStatus";
const ConfigMutationModals = lazy(() => import("@/features/agents/components/ConfigMutationModals").then(m => ({ default: m.ConfigMutationModals })));
import { useConfigMutationQueue } from "@/features/agents/hooks/useConfigMutationQueue";
import { useDraftBatching } from "@/features/agents/hooks/useDraftBatching";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { useLivePatchBatching } from "@/features/agents/hooks/useLivePatchBatching";
import { useSpecialUpdates } from "@/features/agents/hooks/useSpecialUpdates";
import { useAgentHistorySync } from "@/features/agents/hooks/useAgentHistorySync";
import { useDeleteAgent } from "@/features/agents/hooks/useDeleteAgent";
import { useCreateAgent } from "@/features/agents/hooks/useCreateAgent";
import { useRenameAgent } from "@/features/agents/hooks/useRenameAgent";
import { useOfflineQueue } from "@/lib/gateway/useOfflineQueue";
import { useGatewayModels } from "@/features/agents/hooks/useGatewayModels";
import { useSettingsPanel } from "@/features/agents/hooks/useSettingsPanel";
import { useChatCallbacks } from "@/features/agents/hooks/useChatCallbacks";
import { isWide } from "@/hooks/useBreakpoint";
import { useAppLayout } from "@/hooks/useAppLayout";
import { useWorkspaceHealth } from "@/features/workspace/hooks/useWorkspaceHealth";

const AgentStudioPage = () => {
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
    settingsCoordinator,
  } = useGateway();

  const { state, dispatch, hydrateAgents, setError, setLoading } = useAgentStore();
  const layout = useAppLayout();
  const {
    breakpoint, showSidebarInline, showContextInline, isMobileLayout,
    mobilePane, setMobilePane,
    sessionSidebarCollapsed, setSessionSidebarCollapsed,
    mobileSessionDrawerOpen, setMobileSessionDrawerOpen,
    contextPanelOpen, setContextPanelOpen,
    contextMode, setContextMode,
    contextTab, setContextTab,
    expandedTab,
    brainFileTab, setBrainFileTab,
    brainPreviewMode, setBrainPreviewMode,
    managementView, setManagementView,
    headerVisible, onHoverZoneEnter, onHoverZoneLeave,
    handleExpandToggle, clearExpandedTab, switchToChat,
    handleFilesToggle, handleBackToChat,
    swipeHandlers,
  } = layout;
  const [showConnectionPanel, setShowConnectionPanel] = useState(false);
  const [showTaskWizard, setShowTaskWizard] = useState(false);
  const [showAgentWizard, setShowAgentWizard] = useState(false);
  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");
  const [focusedPreferencesLoaded, setFocusedPreferencesLoaded] = useState(false);
  const [agentsLoadedOnce, setAgentsLoadedOnce] = useState(false);
  const stateRef = useRef(state);
  const focusFilterTouchedRef = useRef(false);
  const sessionsUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cronUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable refs for load functions — avoids useEffect dependency cascades that
  // cause event handler teardown/recreation loops and RPC call storms.
  // Initialized with no-ops; updated after their hooks define them below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadAllCronJobsRef = useRef<() => Promise<any>>(() => Promise.resolve());
  const allCronJobsRef = useRef<CronJobSummary[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadTasksRef = useRef<() => Promise<any>>(() => Promise.resolve());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadAllSessionsRef = useRef<() => Promise<any>>(() => Promise.resolve());
  const loadChannelsStatusRef = useRef<() => Promise<void>>(() => Promise.resolve());
  // loadCumulativeUsageRef removed — sessions.usage aggregate eliminated (P0 perf fix)
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
  const cronMaxConcurrentRuns = useMemo(() => {
    const cfg = gatewayConfigSnapshot?.config as Record<string, unknown> | undefined;
    const cron = cfg?.cron;
    if (typeof cron === "object" && cron != null) {
      const val = (cron as Record<string, unknown>).maxConcurrentRuns;
      return typeof val === "number" ? val : undefined;
    }
    return undefined;
  }, [gatewayConfigSnapshot]);
  const [stopBusyAgentId, setStopBusyAgentId] = useState<string | null>(null);
  /** Increments on cron/session events to trigger event-driven refresh in panels */
  const [cronEventTick, setCronEventTick] = useState(0);

  // Layout keyboard shortcuts, persistence, and swipe handled by useAppLayout
  const [viewingSessionKey, setViewingSessionKey] = useState<string | null>(null);
  const [viewingSessionHistory, setViewingSessionHistory] = useState<MessagePart[]>([]);
  const [viewingTrace, setViewingTrace] = useState<{ agentId: string; sessionId: string } | null>(null);
  const [viewingSessionLoading, setViewingSessionLoading] = useState(false);

  const clearViewingTrace = useCallback(() => setViewingTrace(null), []);
  const closeTaskWizard = useCallback(() => setShowTaskWizard(false), []);

  /** Tracks previous session key per agent to detect session resets */
  const prevSessionKeyByAgentRef = useRef<Map<string, string>>(new Map());
  /** Agent IDs that just had a session reset (key changed) — auto-clears after 60s */
  const [sessionContinuedAgents, setSessionContinuedAgents] = useState<Set<string>>(new Set());
  /** Context window utilization per agent — totalTokens = last turn's prompt size, contextTokens = model limit */
  const [agentContextWindow, setAgentContextWindow] = useState<Map<string, { totalTokens: number; contextTokens: number }>>(new Map());
  const gatewayConfigSnapshotRef = useRef(gatewayConfigSnapshot);
  gatewayConfigSnapshotRef.current = gatewayConfigSnapshot;

  const runtimeEventHandlerRef = useRef<ReturnType<typeof createGatewayRuntimeEventHandler> | null>(
    null
  );

  // Exec-approval state from provider
  const {
    setQueue: setExecApprovalQueue,
    reset: resetExecApprovals,
  } = useExecApprovalContext();

  const {
    channelsSnapshot, channelsLoading, channelsError,
    loadChannelsStatus, resetChannelsStatus,
  } = useChannelsStatus(client, status);

  const {
    gatewayVersion, gatewayUptime,
    loadGatewayStatus, parsePresenceFromStatus, resetPresence,
  } = useGatewayStatus(client, status);

  const { health: sidecarHealth, error: sidecarError } = useWorkspaceHealth();

  const {
    sessionUsage, sessionUsageLoading,
    loadSessionUsage, resetSessionUsage,
  } = useSessionUsage(client, status);

  // P0: sessions.usage aggregate RPC eliminated — use aggregateTokensFromList instead
  // (sessions.usage was taking 1-8 seconds and causing slow consumer disconnects)

  const {
    allSessions, allSessionsLoading, allSessionsError,
    aggregateUsageFromList, usageByType, loadAllSessions,
  } = useAllSessions(client, status);

  const {
    allCronJobs, allCronLoading, allCronError,
    allCronRunBusyJobId, allCronDeleteBusyJobId,
    loadAllCronJobs, handleAllCronRunJob, handleAllCronDeleteJob, allCronToggleBusyJobId, handleAllCronToggleEnabled,
  } = useAllCronJobs(client, status);

  // Emergency state moved to EmergencyProvider

  useNotificationEvaluator(client, status);

  // Keep load-function refs current (avoids stale closures)
  loadAllCronJobsRef.current = loadAllCronJobs;
  allCronJobsRef.current = allCronJobs;
  loadAllSessionsRef.current = loadAllSessions;
  loadChannelsStatusRef.current = loadChannelsStatus;
  // loadCumulativeUsageRef removed — sessions.usage aggregate eliminated (P0 perf fix)

  const { flushPendingDraft, handleDraftChange, pendingDraftValuesRef, pendingDraftTimersRef } =
    useDraftBatching(dispatch);

  const { queueLivePatch, clearPendingLivePatch } = useLivePatchBatching(dispatch);

  const agents = state.agents;
  const {
    settingsAgentId, setSettingsAgentId, settingsAgent,
  } = useSettingsPanel({ status, agents });
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

  // Command Palette (Cmd+K)
  const handleManagementNav = useCallback((tab: ManagementTab) => {
    if (tab === "settings" && focusedAgent && !settingsAgentId) {
      setSettingsAgentId(focusedAgent.agentId);
    }
    // Toggle: clicking the active tab closes the drawer
    setManagementView((prev) => (prev === tab ? null : tab));
  }, [focusedAgent, settingsAgentId, setSettingsAgentId, setManagementView]);

  const handleCmdNavTab = useCallback((tab: ContextTab | "sessions" | "usage" | "channels" | "cron" | "settings") => {
    const contextTabs = new Set<string>(["projects", "tasks", "brain", "workspace", "activity"]);
    if (contextTabs.has(tab)) {
      setContextTab(tab as ContextTab);
      setContextPanelOpen(true);
      if (mobilePane !== "context") setMobilePane("context");
    } else {
      // Management tabs show inline in center area
      if (tab === "settings" && focusedAgent && !settingsAgentId) {
        setSettingsAgentId(focusedAgent.agentId);
      }
      setManagementView(tab as ManagementTab);
    }
  }, [mobilePane, focusedAgent, settingsAgentId, setSettingsAgentId, setContextTab, setContextPanelOpen, setMobilePane, setManagementView]);
  const handleCmdOpenCtx = useCallback(() => setContextPanelOpen(true), [setContextPanelOpen]);
  const handleCmdSwitchAgent = useCallback((agentId: string) => {
    flushPendingDraft(focusedAgent?.agentId ?? null);
    dispatch({ type: "selectAgent", agentId });
  }, [flushPendingDraft, focusedAgent?.agentId, dispatch]);
  // Project creation trigger (incremented by command palette)
  const [createProjectTick, setCreateProjectTick] = useState(0);
  const handleCmdCreateProject = useCallback(() => {
    handleCmdNavTab("projects");
    handleCmdOpenCtx();
    setCreateProjectTick((t) => t + 1);
  }, [handleCmdNavTab, handleCmdOpenCtx]);
  const commandPalette = useCommandPalette({
    onNavigateTab: handleCmdNavTab,
    onOpenContextPanel: handleCmdOpenCtx,
    agentIds: agents.map((a) => a.agentId),
    currentAgentId: focusedAgentId ?? undefined,
    onSwitchAgent: handleCmdSwitchAgent,
    client,
    onCreateProject: handleCmdCreateProject,
  });

  // Breadcrumb agents for header agent switcher
  const breadcrumbAgents: BreadcrumbAgent[] = useMemo(
    () =>
      agents.map((a) => ({
        agentId: a.agentId,
        name: a.name,
        status: a.status,
        model: a.model,
        avatarSeed: a.avatarSeed,
        avatarUrl: a.avatarUrl,
      })),
    [agents],
  );

  const {
    tasks: agentTasks,
    loading: tasksLoading,
    error: tasksError,
    busyTaskId,
    busyAction,
    loadTasks,
    createTask,
    toggleTask,
    updateTask,
    updateTaskSchedule,
    runTask,
    deleteTask,
  } = useAgentTasks(client, status, focusedAgentId);
  loadTasksRef.current = loadTasks;

  // Capture transcripts from completed cron/subagent sessions
  const focusedAgentRef = useRef(focusedAgent);
  focusedAgentRef.current = focusedAgent;
  const focusedAgentRunning = focusedAgent?.status === "running";
  const selectedBrainAgentId = useMemo(() => {
    return focusedAgent?.agentId ?? agents[0]?.agentId ?? null;
  }, [agents, focusedAgent]);
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for Phase 6 (FleetSidebar removal)
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
    void loadGatewayStatus();
    void parsePresenceFromStatus();
    // Note: loadAllSessions, loadAllCronJobs, loadChannelsStatus are called
    // from the agent-load effect below (with mutation guards) to avoid duplicates.
  }, [loadGatewayStatus, parsePresenceFromStatus, resetChannelsStatus, resetExecApprovals, resetPresence, resetSessionUsage, status]);

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

  // Detect session key changes (session resets) to show continuation banner
  useEffect(() => {
    if (!focusedAgentId || !focusedSessionKey) return;
    const prevKey = prevSessionKeyByAgentRef.current.get(focusedAgentId);
    prevSessionKeyByAgentRef.current.set(focusedAgentId, focusedSessionKey);
    // Only trigger if we had a previous key and it changed (not first load)
    if (prevKey && prevKey !== focusedSessionKey) {
      setSessionContinuedAgents((prev) => {
        const next = new Set(prev);
        next.add(focusedAgentId);
        return next;
      });
      // Auto-dismiss after 60s
      const timer = window.setTimeout(() => {
        setSessionContinuedAgents((prev) => {
          const next = new Set(prev);
          next.delete(focusedAgentId);
          return next;
        });
      }, 60_000);
      return () => window.clearTimeout(timer);
    }
  }, [focusedAgentId, focusedSessionKey]);

  // Reload usage when turn completes (running → idle). No polling — event-driven only.
  const prevStatusRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!focusedSessionKey || !focusedAgentId) return;
    const prev = prevStatusRef.current;
    prevStatusRef.current = focusedAgentStatus ?? undefined;
    if (prev === "running" && focusedAgentStatus === "idle") {
      void loadSessionUsageRef.current(focusedSessionKey);
      void refreshContextWindowRef.current(focusedAgentId, focusedSessionKey);
      void loadAllSessionsRef.current(); // refresh aggregate tokens from list
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

  // Break circular dependency: lifecycle hooks need enqueueConfigMutation,
  // useConfigMutationQueue needs lifecycle block phases. Use a ref.
  const enqueueConfigMutationRef = useRef<(params: {
    kind: "create-agent" | "rename-agent" | "delete-agent";
    label: string;
    run: () => Promise<void>;
  }) => Promise<void>>(async () => {});

  const stableEnqueueConfigMutation = useCallback(
    (params: { kind: "create-agent" | "rename-agent" | "delete-agent"; label: string; run: () => Promise<void> }) =>
      enqueueConfigMutationRef.current(params),
    []
  );

  const {
    deleteAgentBlock,
    deleteConfirmAgentId,
    setDeleteConfirmAgentId,
    handleConfirmDeleteAgent,
    handleDeleteAgent,
  } = useDeleteAgent({
    client,
    agents,
    status,
    setError,
    enqueueConfigMutation: stableEnqueueConfigMutation,
    loadAgents,
    setSettingsAgentId,
    setMobilePane,
    isBusy: false, // mutual exclusion handled at UI level
  });

  const {
    createAgentBlock,
  } = useCreateAgent({
    client,
    dispatch,
    stateRef,
    status,
    setError,
    enqueueConfigMutation: stableEnqueueConfigMutation,
    loadAgents,
    flushPendingDraft,
    focusedAgentId: focusedAgent?.agentId ?? null,
    setFocusFilter,
    focusFilterTouchedRef,
    setSettingsAgentId,
    setMobilePane,
    isBusy: false,
  });

  const {
    renameAgentBlock,
    handleRenameAgent,
  } = useRenameAgent({
    client,
    dispatch,
    agents,
    status,
    setError,
    enqueueConfigMutation: stableEnqueueConfigMutation,
    loadAgents,
    setMobilePane,
    isBusy: false,
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
    // P0/P1: Stagger initial load — fire agents first, defer heavy RPCs by 2s
    // to let the WS buffer drain before adding load (prevents slow consumer)
    void loadAgents();
    const deferTimer = window.setTimeout(() => {
      void loadChannelsStatusRef.current();
      void loadAllSessionsRef.current();
      void loadAllCronJobsRef.current();
      void loadTasksRef.current();
    }, client.connectedForMs < 3_000 ? 2_000 : 0);
    return () => window.clearTimeout(deferTimer);
  }, [
    client,
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

  // When the selected agent changes, update settings to follow if settings is active
  useEffect(() => {
    if (!state.selectedAgentId) return;
    if ((expandedTab === "settings" || managementView === "settings") && state.selectedAgentId !== settingsAgentId) {
      setSettingsAgentId(state.selectedAgentId);
    } else if (settingsAgentId && state.selectedAgentId !== settingsAgentId) {
      setSettingsAgentId(null);
    }
  }, [expandedTab, managementView, settingsAgentId, setSettingsAgentId, state.selectedAgentId]);

  // Settings agent reset + cron/heartbeat loading handled by useSettingsPanel hook

  // Auto-close brain tab in context panel if no agents
  useEffect(() => {
    if (contextTab !== "brain" || contextMode !== "agent") return;
    if (selectedBrainAgentId) return;
    setContextTab("tasks");
  }, [contextMode, contextTab, selectedBrainAgentId, setContextTab]);

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

  // Poll summary every 30s when any agent is running.
  // Pauses when tab is hidden via useVisibilityRefresh.
  useVisibilityRefresh(
    () => void loadSummarySnapshotRef.current(),
    {
      pollMs: 30_000,
      enabled: status === "connected" && hasRunningAgents,
      debounceMs: 2_000,
    },
  );

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

  const {
    handleNewSession,
    handleSend,
    handleStopRun,
    handleModelChange,
    handleThinkingChange,
    handleToolCallingToggle,
    handleThinkingTracesToggle,
  } = useChatCallbacks({
    client,
    status,
    agents,
    dispatch,
    stateRef,
    runtimeEventHandlerRef,
    historyInFlightRef,
    specialUpdateRef,
    specialUpdateInFlightRef,
    pendingDraftTimersRef,
    pendingDraftValuesRef,
    setError,
    setSettingsAgentId,
    setMobilePane,
    stopBusyAgentId,
    setStopBusyAgentId,
  });

  const { isOffline, queueLength, enqueue } = useOfflineQueue(client, status, handleSend);

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
        setCronEventTick((prev) => prev + 1);
      },
      // Heartbeats routed via onActivityMessage below — no separate store needed
      onSystemEvent: () => {
        // System events now routed via onActivityMessage to useActivityMessageStore
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      onSubAgentLifecycle: (_sessionKey: string, _phase: string) => {
        // Sub-agent lifecycle tracking — available for future use
      },
      onActivityMessage: (sourceKey, data) => {
        // Resolve task name from cron job ID for display
        let sourceName = data.sourceName;
        if (!sourceName) {
          const cronMatch = sourceKey.match(/:cron:([^:]+)/);
          if (cronMatch) {
            const job = allCronJobsRef.current.find((j) => j.id === cronMatch[1]);
            if (job) sourceName = job.name;
          }
          if (!sourceName) sourceName = data.sourceType === "heartbeat" ? "Heartbeat" : "Agent Run";
        }
        if (data.status === "streaming") {
          // Accumulate parts for streaming messages
          appendActivityParts(sourceKey, data.parts, {
            sourceName,
            sourceType: data.sourceType,
            status: "streaming",
          });
        } else if (data.status === "complete" || data.status === "error") {
          // For final/error: append any remaining parts then finalize
          if (data.parts.length > 0) {
            appendActivityParts(sourceKey, data.parts, {
              sourceName,
              sourceType: data.sourceType,
            });
          }
          finalizeActivityMessage(sourceKey, data.status);
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

  const stableChatOnSend = useCallback((message: string, attachments?: { mimeType: string; fileName: string; content: string }[]) => {
    const fa = focusedAgentRef.current;
    if (!fa) return;
    setViewingSessionKey(null);
    if (isOffline) {
      enqueue(fa.agentId, fa.sessionKey, message, attachments);
      // Show the message in the chat as pending
      dispatch({
        type: "appendPart",
        agentId: fa.agentId,
        part: { type: "text", text: `> ${message.trim()}` },
      });
      dispatch({
        type: "appendPart",
        agentId: fa.agentId,
        part: { type: "text", text: "⏳ *Message queued — will send when reconnected*" },
      });
    } else {
      handleSend(fa.agentId, fa.sessionKey, message, attachments);
    }
  }, [handleSend, isOffline, enqueue, dispatch]);

  const stableChatOnStopRun = useCallback(() => {
    const fa = focusedAgentRef.current;
    if (fa) handleStopRun(fa.agentId, fa.sessionKey);
  }, [handleStopRun]);

  const stableChatOnNewSession = useCallback(() => {
    const fa = focusedAgentRef.current;
    if (fa) handleNewSession(fa.agentId);
  }, [handleNewSession]);

  const stableChatOnExitSessionView = useCallback(() => {
    setViewingSessionKey(null);
  }, []);

  const handleViewTrace = useCallback((sessionKey: string, agentId: string | null) => {
    if (!agentId) return;
    // SessionKey format: "agent:<agentId>:<sessionId>" — extract sessionId
    const prefix = `agent:${agentId}:`;
    const sessionId = sessionKey.startsWith(prefix) ? sessionKey.slice(prefix.length) : sessionKey;
    setViewingTrace({ agentId, sessionId });
  }, []);

  const stableChatOnDismissContinuation = useCallback(() => {
    const fa = focusedAgentRef.current;
    if (fa) {
      setSessionContinuedAgents((prev) => {
        const next = new Set(prev);
        next.delete(fa.agentId);
        return next;
      });
    }
  }, []);

  const stableChatTokenUsed = useMemo(() => {
    if (!focusedAgent) return undefined;
    const cw = agentContextWindow.get(focusedAgent.agentId);
    if (cw && cw.totalTokens > 0) return cw.totalTokens;
    return sessionUsage ? sessionUsage.inputTokens + sessionUsage.outputTokens : undefined;
  }, [focusedAgent, agentContextWindow, sessionUsage]);

  // Shared transcript click handler — used by both ManagementDrawer and PanelExpandModal
  const handleTranscriptClick = useCallback(
    (sessionId: string, agentId: string | null, dismissFn?: () => void) => {
      dismissFn?.();
      const effectiveAgentId = agentId || focusedAgent?.agentId || "";
      if (!effectiveAgentId) return;
      setViewingSessionKey(sessionId);
      setViewingSessionLoading(true);
      setViewingSessionHistory([]);
      setMobilePane("chat");
      fetchTranscriptMessages(effectiveAgentId, sessionId, 0, 200)
        .then((result) => {
          setViewingSessionHistory(transformMessagesToMessageParts(result.messages));
        })
        .catch((err) => {
          console.error("Failed to load transcript:", err);
          setViewingSessionHistory([{
            type: "text",
            text: `Failed to load transcript: ${err instanceof Error ? err.message : "Unknown error"}`,
          }]);
        })
        .finally(() => setViewingSessionLoading(false));
    },
    [focusedAgent?.agentId, setMobilePane],
  );

  const handleDrawerTranscriptClick = useCallback(
    (sessionId: string, agentId: string | null) => {
      handleTranscriptClick(sessionId, agentId, () => setManagementView(null));
    },
    [handleTranscriptClick, setManagementView],
  );

  const handleExpandedTranscriptClick = useCallback(
    (sessionId: string, agentId: string | null) => {
      handleTranscriptClick(sessionId, agentId, clearExpandedTab);
    },
    [handleTranscriptClick, clearExpandedTab],
  );

  // Shared management panel props — used by both ManagementDrawer and PanelExpandModal
  const managementPanelProps = useMemo(() => ({
    client,
    status,
    focusedAgentId,
    allSessions,
    allSessionsLoading,
    allSessionsError,
    onRefreshSessions: () => { void loadAllSessions(); },
    activeSessionKey: focusedAgent?.sessionKey ?? null,
    aggregateUsage,
    aggregateUsageLoading,
    cumulativeUsage: aggregateUsageFromList ? {
      inputTokens: aggregateUsageFromList.inputTokens,
      outputTokens: aggregateUsageFromList.outputTokens,
      totalCost: null,
      messageCount: aggregateUsageFromList.messageCount,
    } : null,
    cumulativeUsageLoading: allSessionsLoading,
    usageByType,
    onViewTrace: handleViewTrace,
    channelsSnapshot,
    channelsLoading,
    channelsError,
    onRefreshChannels: () => { void loadChannelsStatus(); },
    allCronJobs,
    allCronLoading,
    allCronError,
    allCronRunBusyJobId,
    allCronDeleteBusyJobId,
    allCronToggleBusyJobId,
    onRunJob: (jobId: string) => { void handleAllCronRunJob(jobId); },
    onDeleteJob: (jobId: string) => { void handleAllCronDeleteJob(jobId); },
    onToggleEnabled: (jobId: string) => { void handleAllCronToggleEnabled(jobId); },
    onRefreshCron: () => { void loadAllCronJobs(); },
    settingsAgent: settingsAgent ?? null,
    onCloseSettings: handleBackToChat,
    onRenameAgent: (name: string) => settingsAgent ? handleRenameAgent(settingsAgent.agentId, name) : Promise.resolve(false),
    onNewSession: () => { if (settingsAgent) handleNewSession(settingsAgent.agentId); },
    onDeleteAgent: () => { if (settingsAgent) handleDeleteAgent(settingsAgent.agentId); },
    onToolCallingToggle: (enabled: boolean) => { if (settingsAgent) handleToolCallingToggle(settingsAgent.agentId, enabled); },
    onThinkingTracesToggle: (enabled: boolean) => { if (settingsAgent) handleThinkingTracesToggle(settingsAgent.agentId, enabled); },
    onNavigateToTasks: () => setContextTab("tasks"),
  }), [
    client, status, focusedAgentId, allSessions, allSessionsLoading, allSessionsError,
    loadAllSessions, focusedAgent?.sessionKey, aggregateUsage, aggregateUsageLoading,
    aggregateUsageFromList, usageByType, handleViewTrace,
    channelsSnapshot, channelsLoading, channelsError, loadChannelsStatus,
    allCronJobs, allCronLoading, allCronError, allCronRunBusyJobId,
    allCronDeleteBusyJobId, allCronToggleBusyJobId,
    handleAllCronRunJob, handleAllCronDeleteJob, handleAllCronToggleEnabled, loadAllCronJobs,
    settingsAgent, handleBackToChat, handleRenameAgent, handleNewSession,
    handleDeleteAgent, handleToolCallingToggle, handleThinkingTracesToggle, setContextTab,
  ]);

  const stableChatTokenLimit = useMemo(() => {
    if (!focusedAgent) return undefined;
    const cw = agentContextWindow.get(focusedAgent.agentId);
    if (cw && cw.contextTokens > 0) return cw.contextTokens;
    return findModelMatch(focusedAgent.model)?.contextWindow;
  }, [focusedAgent, agentContextWindow, findModelMatch]);

  if (status === "connecting" || (status === "connected" && !agentsLoadedOnce)) {
    return (
      <div className="relative w-screen overflow-hidden bg-background" style={{ minHeight: '100svh' }}>
        <div className="flex items-center justify-center px-6" style={{ minHeight: '100svh' }}>
          <div className="bg-card rounded-lg w-full max-w-md px-6 py-8 flex flex-col items-center gap-4">
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
    <EmergencyProvider>
    <Suspense fallback={null}>
    <div className="relative w-screen overflow-hidden bg-background" style={{ minHeight: '100svh' }}>
      {state.loading ? (
        <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-50 flex justify-center px-3">
          <div className="bg-card rounded-lg px-6 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Loading agents…
          </div>
        </div>
      ) : null}
      <div className="relative w-full overflow-hidden bg-background" style={{ height: '100svh' }}>
        {/* ── Header hover zone: reveals header on mouse enter ──────── */}
        <div
          className="fixed inset-x-0 top-0 z-30 h-3"
          onMouseEnter={onHoverZoneEnter}
          onMouseLeave={onHoverZoneLeave}
          aria-hidden="true"
        />
        {/* ── Header: fixed glassmorphic bar with auto-hide ──────────── */}
        <div
          className={`fixed inset-x-0 top-0 z-30 transform-gpu transition-transform duration-300 ease-out ${headerVisible ? "translate-y-0" : "-translate-y-full"}`}
          onMouseEnter={onHoverZoneEnter}
          onMouseLeave={onHoverZoneLeave}
        >
          <HeaderBar
            status={status}
            running={focusedAgentRunning}
            onConnectionSettings={() => setShowConnectionPanel((prev) => !prev)}
            onFilesToggle={handleFilesToggle}
            filesActive={contextMode === "files"}
            onOpenContext={() => {
              if (isWide(breakpoint)) {
                setContextPanelOpen(true);
              } else {
                setMobilePane("context");
              }
            }}
            onOpenSessionHistory={() => setMobileSessionDrawerOpen(true)}
            onNewSession={stableChatOnNewSession}
            onOpenSettings={() => {
              if (focusedAgent && !settingsAgentId) {
                setSettingsAgentId(focusedAgent.agentId);
              }
              setManagementView("settings");
            }}
            agents={breadcrumbAgents}
            selectedAgentId={focusedAgentId}
            onSelectAgent={(agentId) => {
              flushPendingDraft(focusedAgent?.agentId ?? null);
              dispatch({ type: "selectAgent", agentId });
            }}
            onCreateAgent={() => setShowAgentWizard(true)}
            gatewayVersion={gatewayVersion}
            gatewayUptime={gatewayUptime}
            sidecarHealth={sidecarHealth}
            sidecarError={sidecarError}
            showContextTabs={isWide(breakpoint)}
            contextTab={contextTab}
            contextPanelOpen={contextPanelOpen}
            onContextTabClick={(tab) => {
              if (contextPanelOpen && contextTab === tab) {
                setContextPanelOpen(false);
              } else {
                setContextTab(tab);
                setContextPanelOpen(true);
              }
            }}
            onContextClose={() => setContextPanelOpen(false)}
          />
        </div>

        {/* ── Status banners: fixed below header ───────────────────── */}
        {connectionPanelVisible ? (
          <div className="fixed inset-x-0 top-12 z-30">
            <div className="rounded-lg bg-card px-4 py-4 sm:px-6 sm:py-6">
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
          <div className="fixed inset-x-0 top-12 z-30">
            <div className="rounded-md border border-destructive bg-destructive px-4 py-2 text-sm text-destructive-foreground">
              {errorMessage}
            </div>
          </div>
        ) : null}
        {configMutationStatusLine ? (
          <div className="fixed inset-x-0 top-12 z-30">
            <div className="rounded-md border border-border/80 bg-card/80 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.11em] text-muted-foreground">
              {configMutationStatusLine}
            </div>
          </div>
        ) : null}

        {/* ── Gateway connection banner: shown when disconnected ──── */}
        {status !== "connected" && !connectionPanelVisible ? (
          <div className="fixed inset-x-0 top-12 z-30">
            <GatewayStatusBanner
              status={status}
              onReconnect={() => void connect()}
            />
          </div>
        ) : null}

        {showFleetLayout ? (
          <div className="absolute inset-0 pt-12">
            {/* Backdrop for mobile context drawer */}
            {mobilePane !== "chat" && !showContextInline ? (
              <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                onClick={switchToChat}
              />
            ) : null}
            {/* Mobile session history overlay drawer — includes management nav + session history */}
            {mobileSessionDrawerOpen && !showSidebarInline ? (
              <div
                className="fixed inset-0 z-50"
                onClick={() => setMobileSessionDrawerOpen(false)}
              >
                <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                <div
                  className="absolute inset-y-0 left-0 w-[280px] animate-in slide-in-from-left duration-200 ease-[cubic-bezier(0.32,0.72,0,1)] bg-[var(--surface-elevated)] flex flex-col"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Agent list for mobile */}
                  {breadcrumbAgents.length > 1 && (
                    <div className="border-b border-border/40 px-3 py-2.5">
                      <p className={`${sectionLabelClass} mb-1.5 px-0.5 text-[10px]`}>Agents</p>
                      <div className="flex flex-col gap-0.5">
                        {breadcrumbAgents.map((agent) => (
                          <button
                            key={agent.agentId}
                            type="button"
                            onClick={() => {
                              flushPendingDraft(focusedAgent?.agentId ?? null);
                              dispatch({ type: "selectAgent", agentId: agent.agentId });
                              setMobileSessionDrawerOpen(false);
                            }}
                            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2.5 text-left text-[13px] font-medium transition-colors min-h-[44px] ${
                              agent.agentId === focusedAgentId
                                ? "bg-accent text-accent-foreground"
                                : "text-foreground/80 hover:bg-muted"
                            }`}
                          >
                            <span className={`inline-block h-2 w-2 rounded-full shrink-0 ${
                              agent.status === "running" ? "bg-emerald-400" : "bg-muted-foreground/30"
                            }`} />
                            {agent.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Management nav items for mobile */}
                  <div className="flex flex-col gap-0.5 border-b border-border/40 px-3 py-3">
                    {([
                      { value: "sessions" as ManagementTab, label: "Sessions" },
                      { value: "usage" as ManagementTab, label: "Usage" },
                      { value: "channels" as ManagementTab, label: "Channels" },
                      { value: "cron" as ManagementTab, label: "Cron" },
                      { value: "settings" as ManagementTab, label: "Settings" },
                    ]).map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => {
                          handleManagementNav(item.value);
                          setMobileSessionDrawerOpen(false);
                        }}
                        className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-[13px] font-medium transition-colors min-h-[44px] ${
                          managementView === item.value
                            ? "bg-accent text-accent-foreground"
                            : "text-foreground/80 hover:bg-muted"
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  {/* Session history */}
                  <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                    <SessionHistorySidebar
                      client={client}
                      status={status}
                      agentId={focusedAgentId}
                      activeSessionKey={viewingSessionKey ?? (focusedAgent ? `${focusedAgent.agentId}:main` : null)}
                      onSelectSession={(key) => {
                        setViewingSessionKey(key === `${focusedAgentId}:main` ? null : key);
                        setMobileSessionDrawerOpen(false);
                      }}
                      onNewSession={() => {
                        stableChatOnNewSession();
                        setMobileSessionDrawerOpen(false);
                      }}
                      collapsed={false}
                      onToggleCollapse={() => setMobileSessionDrawerOpen(false)}
                    />
                  </div>
                </div>
              </div>
            ) : null}
            {/* App sidebar — desktop only, collapsible: floating overlay */}
            <div className={`${showSidebarInline ? "fixed inset-y-0 left-0 top-12 z-20 flex" : "hidden"}`}>
              <AppSidebar
                client={client}
                status={status}
                agentId={focusedAgentId}
                activeSessionKey={viewingSessionKey ?? (focusedAgent ? `${focusedAgent.agentId}:main` : null)}
                onSelectSession={(key) => setViewingSessionKey(key === `${focusedAgentId}:main` ? null : key)}
                onNewSession={stableChatOnNewSession}
                collapsed={sessionSidebarCollapsed}
                onToggleCollapse={() => setSessionSidebarCollapsed((p) => !p)}
                onManagementNav={handleManagementNav}
                activeManagementTab={managementView}
              />
            </div>
            {/* ── Chat canvas: base layer filling viewport ─────────── */}
            <div
              className="absolute inset-0 z-0 flex overflow-hidden"
              data-testid="focused-agent-panel"
              {...swipeHandlers}
            >
              {/* Management drawer — slides in from left beside sidebar */}
              <ManagementDrawer
                open={managementView !== null}
                onOpenChange={(open) => { if (!open) setManagementView(null); }}
                title={managementView ? ({ sessions: "Sessions", usage: "Usage", channels: "Channels", cron: "Cron", settings: "Settings" } as Record<ManagementTab, string>)[managementView] : ""}
                sidebarOffsetPx={sessionSidebarCollapsed ? 56 : 288}
              >
                <ManagementPanelContent
                  tab={managementView}
                  {...managementPanelProps}
                  onTranscriptClick={handleDrawerTranscriptClick}
                />
              </ManagementDrawer>

              {focusedAgent ? (
                <AgentChatPanel
                  agent={focusedAgent}
                  canSend={status === "connected" || isOffline}
                  gatewayStatus={status}
                  queueLength={queueLength}
                  models={gatewayModels}
                  stopBusy={stopBusyAgentId === focusedAgent.agentId}
                  onModelChange={stableChatOnModelChange}
                  onThinkingChange={stableChatOnThinkingChange}
                  onDraftChange={stableChatOnDraftChange}
                  onSend={stableChatOnSend}
                  onStopRun={stableChatOnStopRun}
                  onNewSession={stableChatOnNewSession}
                  tokenUsed={stableChatTokenUsed}
                  tokenLimit={stableChatTokenLimit}
                  viewingSessionKey={viewingSessionKey}
                  viewingSessionHistory={viewingSessionHistory}
                  viewingSessionLoading={viewingSessionLoading}
                  onExitSessionView={stableChatOnExitSessionView}
                  sessionContinued={sessionContinuedAgents.has(focusedAgent.agentId)}
                  onDismissContinuationBanner={stableChatOnDismissContinuation}
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
                  <Users className="h-10 w-10 opacity-30" />
                  <p className="text-sm">
                    {hasAnyAgents
                      ? "No agents match this filter."
                      : "No agents available."}
                  </p>
                  {!hasAnyAgents && (
                    <p className="text-xs text-muted-foreground/70">
                      Use New Agent in the sidebar to add your first agent.
                    </p>
                  )}
                </div>
              )}
            </div>
            {/* Expanded panel modal */}
            {expandedTab && (
              <PanelExpandModal
                open
                onOpenChange={clearExpandedTab}
                title={TAB_OPTIONS.find((t) => t.value === expandedTab)?.label ?? ({ sessions: "Sessions", usage: "Usage", channels: "Channels", cron: "Cron", settings: "Settings" } as Record<string, string>)[expandedTab] ?? ""}
              >
                <ExpandedContext.Provider value={true}>
                  <div className="flex h-full w-full flex-col overflow-y-auto">
                    {expandedTab === "projects" && (
                      <PanelErrorBoundary name="Projects">
                        <ProjectsPanel agentId={focusedAgent?.agentId ?? null} client={client} isTabActive eventTick={cronEventTick} requestCreateProject={createProjectTick} />
                      </PanelErrorBoundary>
                    )}
                    {expandedTab === "tasks" && (
                      <PanelErrorBoundary name="Tasks">
                        <TasksPanel
                          isSelected
                          client={client}
                          tasks={agentTasks}
                          loading={tasksLoading}
                          error={tasksError}
                          busyTaskId={busyTaskId}
                          busyAction={busyAction}
                          onToggle={toggleTask}
                          onUpdateTask={updateTask}
                          onUpdateSchedule={updateTaskSchedule}
                          onRun={runTask}
                          onDelete={deleteTask}
                          onRefresh={() => { void loadTasks(); }}
                          onNewTask={() => setShowTaskWizard(true)}
                          maxConcurrentRuns={cronMaxConcurrentRuns}
                        />
                      </PanelErrorBoundary>
                    )}
                    {expandedTab === "brain" && (
                      <PanelErrorBoundary name="Brain">
                        <AgentBrainPanel
                          client={client}
                          agents={agents}
                          selectedAgentId={selectedBrainAgentId}
                          onClose={clearExpandedTab}
                          activeTab={brainFileTab}
                          onTabChange={setBrainFileTab}
                          previewMode={brainPreviewMode}
                          onPreviewModeChange={setBrainPreviewMode}
                        />
                      </PanelErrorBoundary>
                    )}
                    {expandedTab === "workspace" && (
                      <PanelErrorBoundary name="Workspace">
                        <WorkspaceExplorerPanel
                          client={client}
                          agentId={focusedAgent?.agentId ?? null}
                          isTabActive
                          eventTick={cronEventTick}
                        />
                      </PanelErrorBoundary>
                    )}
                    {expandedTab === "activity" && (
                      <PanelErrorBoundary name="Activity">
                        <ActivityPanel />
                      </PanelErrorBoundary>
                    )}
                    <ManagementPanelContent
                      tab={expandedTab === "sessions" || expandedTab === "usage" || expandedTab === "channels" || expandedTab === "cron" || expandedTab === "settings" ? expandedTab : null}
                      {...managementPanelProps}
                      onCloseSettings={clearExpandedTab}
                      onTranscriptClick={handleExpandedTranscriptClick}
                    />
                  </div>
                </ExpandedContext.Provider>
              </PanelExpandModal>
            )}
            {/* Trace Viewer overlay */}
            {viewingTrace && (
              <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="h-[90vh] w-full max-w-6xl">
                  <TraceViewer
                    agentId={viewingTrace.agentId}
                    sessionId={viewingTrace.sessionId}
                    onClose={clearViewingTrace}
                  />
                </div>
              </div>
            )}
            {/* Context tab cluster is now integrated into HeaderBar on wide viewports */}
            {/* Context Panel: floating overlay — bottom sheet on mobile, right panel on desktop */}
            <div
              className={
                isMobileLayout
                  ? `fixed inset-x-0 bottom-0 z-40 h-[85vh] rounded-t-3xl transform-gpu transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${mobilePane === "context" ? "translate-y-0" : "translate-y-full"} bg-background/95 backdrop-blur-xl ring-1 ring-white/[0.06] border-t border-border/50 min-h-0 overflow-hidden p-0 shadow-[0_-4px_24px_-6px_rgba(0,0,0,0.3)]`
                  : `fixed top-12 right-0 bottom-0 z-20 w-[360px] transform-gpu transition-transform duration-300 ease-out ${showContextInline ? "translate-x-0" : "translate-x-full"} bg-background/60 backdrop-blur-xl ring-1 ring-white/[0.06] min-h-0 overflow-hidden p-0 shadow-[-4px_0_24px_-6px_rgba(0,0,0,0.3)]`
              }
            >
              {/* Bottom sheet drag handle — mobile only, swipe down to dismiss */}
              {isMobileLayout && (
                <div
                  className="flex justify-center py-3 cursor-grab active:cursor-grabbing"
                  aria-hidden="true"
                  onTouchStart={swipeHandlers.onTouchStart}
                  onTouchEnd={swipeHandlers.onTouchEnd}
                >
                  <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
                </div>
              )}
              {contextMode === "files" ? (
                <ArtifactsPanel isSelected />
              ) : (
                <ContextPanel
                  activeTab={contextTab}
                  expandedTab={expandedTab === "projects" || expandedTab === "tasks" || expandedTab === "brain" || expandedTab === "workspace" || expandedTab === "activity" ? expandedTab : null}
                  onExpandToggle={handleExpandToggle}
                  onClose={showContextInline ? () => setContextPanelOpen(false) : undefined}
                  onTabChange={setContextTab}
                  hideTabBar={isWide(breakpoint)}
                  projectsContent={
                    <PanelErrorBoundary name="Projects">
                      <div className="flex h-full w-full flex-col overflow-y-auto">
                        <ProjectsPanel
                          agentId={focusedAgent?.agentId ?? null}
                          client={client}
                          isTabActive={contextTab === "projects"}
                          eventTick={cronEventTick}
                          requestCreateProject={createProjectTick}
                        />
                      </div>
                    </PanelErrorBoundary>
                  }
                  tasksContent={
                    <PanelErrorBoundary name="Tasks">
                      <div className="flex h-full w-full flex-col overflow-y-auto">
                        <TasksPanel
                          isSelected
                          client={client}
                          tasks={agentTasks}
                          loading={tasksLoading}
                          error={tasksError}
                          busyTaskId={busyTaskId}
                          busyAction={busyAction}
                          onToggle={toggleTask}
                          onUpdateTask={updateTask}
                          onUpdateSchedule={updateTaskSchedule}
                          onRun={runTask}
                          onDelete={deleteTask}
                          onRefresh={() => { void loadTasks(); }}
                          onNewTask={() => setShowTaskWizard(true)}
                          maxConcurrentRuns={cronMaxConcurrentRuns}
                        />
                      </div>
                    </PanelErrorBoundary>
                  }
                  brainContent={
                    <PanelErrorBoundary name="Brain">
                      <AgentBrainPanel
                        client={client}
                        agents={agents}
                        selectedAgentId={selectedBrainAgentId}
                        activeTab={brainFileTab}
                        onTabChange={setBrainFileTab}
                        previewMode={brainPreviewMode}
                        onPreviewModeChange={setBrainPreviewMode}
                        onClose={() => {
                          setContextMode("agent");
                          setMobilePane("chat");
                        }}
                      />
                    </PanelErrorBoundary>
                  }
                  workspaceContent={
                    <PanelErrorBoundary name="Workspace">
                      <WorkspaceExplorerPanel
                        key={focusedAgent?.agentId ?? "none"}
                        agentId={focusedAgent?.agentId ?? null}
                        client={client}
                        isTabActive={contextTab === "workspace"}
                        eventTick={cronEventTick}
                      />
                    </PanelErrorBoundary>
                  }
                  activityContent={
                    <PanelErrorBoundary name="Activity">
                      <ActivityPanel />
                    </PanelErrorBoundary>
                  }
                />
              )}
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 pt-12 bg-background rounded-lg fade-up-delay flex flex-col overflow-hidden p-5 sm:p-6">
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
	      </div>
      {/* ExecApprovalOverlay is now rendered by ExecApprovalProvider */}
      <AgentWizardModal
        open={showAgentWizard}
        client={client}
        onCreated={(agentId) => {
          setShowAgentWizard(false);
          void loadAgents();
          dispatch({ type: "selectAgent", agentId });
        }}
        onClose={() => setShowAgentWizard(false)}
      />
      <TaskWizardModal
        open={showTaskWizard}
        agents={agents.map((a) => a.agentId)}
        creating={busyTaskId !== null}
        client={client}
        onClose={closeTaskWizard}
        onCreateTask={createTask}
        onAgentCreated={() => void loadAgents()}
      />
      <CommandPalette
        open={commandPalette.open}
        onOpenChange={commandPalette.setOpen}
        actions={commandPalette.actions}
      />
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
      <EmergencyOverlay />
    </div>
    </Suspense>
    </EmergencyProvider>
  );
};

export default function Home() {
  return (
    <GatewayProvider>
      <AgentStoreProvider>
        <ExecApprovalProvider>
          <AgentStudioPage />
        </ExecApprovalProvider>
      </AgentStoreProvider>
    </GatewayProvider>
  );
}
