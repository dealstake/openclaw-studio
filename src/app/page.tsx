"use client";

import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";
import type { MessagePart } from "@/lib/chat/types";
import { transformMessagesToMessageParts } from "@/features/sessions/lib/transformMessages";
import {
  AgentBrainPanel,
  AgentSettingsPanel,
} from "@/features/agents/components/AgentInspectPanels";
import { SessionHistorySidebar } from "@/features/sessions/components/SessionHistorySidebar";
import type { BreadcrumbAgent } from "@/features/agents/components/AgentBreadcrumb";
import { HeaderBar } from "@/features/agents/components/HeaderBar";
import { ConnectionPanel } from "@/features/agents/components/ConnectionPanel";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
import { BrandMark } from "@/components/brand/BrandMark";
import { Users } from "lucide-react";
import {
  buildAgentInstruction,
} from "@/lib/text/message-extract";
import { useGatewayConnection } from "@/lib/gateway/useGatewayConnection";
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
import { ProjectsPanel } from "@/features/projects/components/ProjectsPanel";
const TaskWizardModal = lazy(() => import("@/features/tasks/components/TaskWizardModal").then(m => ({ default: m.TaskWizardModal })));
const AgentWizardModal = lazy(() => import("@/features/agents/components/AgentWizardModal").then(m => ({ default: m.AgentWizardModal })));
import { useAgentTasks } from "@/features/tasks/hooks/useAgentTasks";
import { ContextPanel, TAB_OPTIONS } from "@/features/context/components/ContextPanel";
import type { ContextTab } from "@/features/context/components/ContextPanel";

/** Extended tab type for expanded modal — includes management tabs not shown in the context panel */
type ExpandableTab = ContextTab | "sessions" | "usage" | "channels" | "cron" | "settings";
import { ContextPanelStrip } from "@/features/context/components/ContextPanelStrip";
import { PanelExpandModal } from "@/components/PanelExpandModal";
import { ExpandedContext } from "@/features/context/lib/expandedContext";
import { ExecApprovalOverlay } from "@/features/exec-approvals/components/ExecApprovalOverlay";
import {
  parseExecApprovalRequested,
  parseExecApprovalResolved,
  pruneExpired,
} from "@/features/exec-approvals/types";
import { ChannelsPanel } from "@/features/channels/components/ChannelsPanel";
const SessionsPanel = lazy(() => import("@/features/sessions/components/SessionsPanel").then(m => ({ default: m.SessionsPanel })));
const CronPanel = lazy(() => import("@/features/cron/components/CronPanel").then(m => ({ default: m.CronPanel })));
const UsagePanel = lazy(() => import("@/features/usage/components/UsagePanel").then(m => ({ default: m.UsagePanel })));
import { CommandPalette } from "@/features/command-palette/components/CommandPalette";
import { useCommandPalette } from "@/features/command-palette/hooks/useCommandPalette";
import { WorkspaceExplorerPanel } from "@/features/workspace/components/WorkspaceExplorerPanel";
import { ActivityDrawer } from "@/features/activity/components/ActivityDrawer";
import { upsertLiveSession, addSystemEvent } from "@/features/activity/hooks/useLiveActivityStore";
import { pushHeartbeatEntry } from "@/features/activity/hooks/useHeartbeatEntries";
import { useTranscriptCapture } from "@/features/activity/hooks/useTranscriptCapture";
import { TraceViewer } from "@/features/sessions/components/TraceViewer";
import { useChannelsStatus } from "@/features/channels/hooks/useChannelsStatus";
import { useAllSessions } from "@/features/sessions/hooks/useAllSessions";
import { useAllCronJobs } from "@/features/cron/hooks/useAllCronJobs";
import type { CronJobSummary } from "@/lib/cron/types";
import { useNotificationEvaluator } from "@/features/notifications/hooks/useNotificationEvaluator";
import { useExecApprovals } from "@/features/exec-approvals/hooks/useExecApprovals";
import { useSessionUsage } from "@/features/sessions/hooks/useSessionUsage";
import { useTranscripts, useTranscriptSearch, fetchTranscriptMessages } from "@/features/sessions/hooks/useTranscripts";
import { useGatewayStatus } from "@/features/status/hooks/useGatewayStatus";
const ConfigMutationModals = lazy(() => import("@/features/agents/components/ConfigMutationModals").then(m => ({ default: m.ConfigMutationModals })));
type MobilePane = "chat" | "context";
import { useConfigMutationQueue } from "@/features/agents/hooks/useConfigMutationQueue";
import { useDraftBatching } from "@/features/agents/hooks/useDraftBatching";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { useLivePatchBatching } from "@/features/agents/hooks/useLivePatchBatching";
import { useSpecialUpdates } from "@/features/agents/hooks/useSpecialUpdates";
import { useAgentHistorySync } from "@/features/agents/hooks/useAgentHistorySync";
import { useAgentLifecycle } from "@/features/agents/hooks/useAgentLifecycle";
import { useGatewayModels } from "@/features/agents/hooks/useGatewayModels";
import { useSettingsPanel } from "@/features/agents/hooks/useSettingsPanel";
import { useBreakpoint, isDesktopOrAbove, isWide, isTabletOrBelow } from "@/hooks/useBreakpoint";
import { useSwipeDrawer } from "@/hooks/useSwipeDrawer";

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
  const [stopBusyAgentId, setStopBusyAgentId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("chat");
  const [sessionSidebarCollapsed, setSessionSidebarCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("studio:session-sidebar-collapsed") === "true";
  });
  const [mobileSessionDrawerOpen, setMobileSessionDrawerOpen] = useState(false);
  const [contextPanelOpen, setContextPanelOpen] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem("studio:context-panel-open") !== "false";
  });
  /** "agent" = show ContextPanel (Tasks/Brain/Settings), "files" = show Files */
  const [contextMode, setContextMode] = useState<"agent" | "files">("agent");
  const [contextTab, setContextTab] = useState<ContextTab>("projects");
  const [expandedTab, setExpandedTab] = useState<ExpandableTab | null>(null);
  // Lifted brain panel state — shared between normal and expanded views
  const [brainFileTab, setBrainFileTab] = useState<import("@/lib/agents/agentFiles").AgentFileName>("AGENTS.md");
  const [brainPreviewMode, setBrainPreviewMode] = useState(true);
  /** Increments on cron/session events to trigger event-driven refresh in panels */
  const [cronEventTick, setCronEventTick] = useState(0);

  const handleExpandToggle = useCallback(() => {
    setExpandedTab((prev) => {
      if (prev) return null;
      // Close mobile drawer before opening modal to prevent stacking overlays
      setMobilePane("chat");
      return contextTab;
    });
  }, [contextTab]);

  // Cmd+Shift+E keyboard shortcut for expand/collapse
  // Persist session sidebar collapsed state
  useEffect(() => {
    localStorage.setItem("studio:session-sidebar-collapsed", String(sessionSidebarCollapsed));
  }, [sessionSidebarCollapsed]);

  // Persist context panel open/closed state
  useEffect(() => {
    localStorage.setItem("studio:context-panel-open", String(contextPanelOpen));
  }, [contextPanelOpen]);

  // Keyboard shortcuts: Cmd+Shift+E expand, Cmd+\ toggle context panel, Cmd+Shift+P/T/B open specific tabs
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.shiftKey && e.key === "E") {
        e.preventDefault();
        setExpandedTab((prev) => (prev ? null : contextTab));
        return;
      }
      if (mod && e.key === "\\") {
        e.preventDefault();
        setContextPanelOpen((prev) => !prev);
        return;
      }
      // Cmd+Shift+P/T/B — open specific context panel tabs
      if (mod && e.shiftKey && (e.key === "P" || e.key === "p")) {
        e.preventDefault();
        setContextTab("projects");
        setContextPanelOpen(true);
        if (mobilePane !== "context") setMobilePane("context");
        return;
      }
      if (mod && e.shiftKey && (e.key === "T" || e.key === "t")) {
        e.preventDefault();
        setContextTab("tasks");
        setContextPanelOpen(true);
        if (mobilePane !== "context") setMobilePane("context");
        return;
      }
      if (mod && e.shiftKey && (e.key === "B" || e.key === "b")) {
        e.preventDefault();
        setContextTab("brain");
        setContextPanelOpen(true);
        if (mobilePane !== "context") setMobilePane("context");
        return;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [contextTab, mobilePane]);
  const [viewingSessionKey, setViewingSessionKey] = useState<string | null>(null);
  const [viewingSessionHistory, setViewingSessionHistory] = useState<MessagePart[]>([]);
  const [viewingTrace, setViewingTrace] = useState<{ agentId: string; sessionId: string } | null>(null);
  const [viewingSessionLoading, setViewingSessionLoading] = useState(false);

  // Stable callbacks for memoized children (avoid inline closures)
  const clearExpandedTab = useCallback(() => setExpandedTab(null), []);
  const clearViewingTrace = useCallback(() => setViewingTrace(null), []);
  const closeTaskWizard = useCallback(() => setShowTaskWizard(false), []);
  const switchToChat = useCallback(() => setMobilePane("chat"), []);

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

  // Extracted hooks
  const {
    execApprovalQueue, setExecApprovalQueue,
    execApprovalBusy, execApprovalError,
    handleExecApprovalDecision, resetExecApprovals,
  } = useExecApprovals(client);

  const {
    channelsSnapshot, channelsLoading, channelsError,
    loadChannelsStatus, resetChannelsStatus,
  } = useChannelsStatus(client, status);

  const {
    gatewayVersion, gatewayUptime,
    loadGatewayStatus, parsePresenceFromStatus, resetPresence,
  } = useGatewayStatus(client, status);

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
    settingsCronJobs, settingsCronLoading, settingsCronError,
    cronRunBusyJobId, cronDeleteBusyJobId,
    settingsHeartbeats, settingsHeartbeatLoading, settingsHeartbeatError,
    heartbeatRunBusyId, heartbeatDeleteBusyId,
    handleRunCronJob, handleDeleteCronJob, cronToggleBusyJobId, handleToggleCronJob,
    handleRunHeartbeat, handleDeleteHeartbeat,
    reloadCronJobs, reloadHeartbeats,
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

  // Command Palette (Cmd+K)
  const handleCmdNavTab = useCallback((tab: ContextTab | "sessions" | "usage" | "channels" | "cron" | "settings") => {
    const contextTabs = new Set<string>(["projects", "tasks", "brain", "workspace"]);
    if (contextTabs.has(tab)) {
      setContextTab(tab as ContextTab);
      setContextPanelOpen(true);
      if (mobilePane !== "context") setMobilePane("context");
    } else {
      // Management tabs open in expanded modal
      if (tab === "settings" && focusedAgent && !settingsAgentId) {
        setSettingsAgentId(focusedAgent.agentId);
      }
      setExpandedTab(tab as ExpandableTab);
    }
  }, [mobilePane, focusedAgent, settingsAgentId, setSettingsAgentId]);
  const handleCmdOpenCtx = useCallback(() => setContextPanelOpen(true), []);
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
    transcripts,
    loading: transcriptsLoading,
    loadingMore: transcriptsLoadingMore,
    error: transcriptsError,
    hasMore: transcriptsHasMore,
    loadMore: transcriptsLoadMore,
    refresh: transcriptsRefresh,
  } = useTranscripts(focusedAgentId);

  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    results: searchResults,
    searching: searchLoading,
    error: searchError,
    clearSearch,
  } = useTranscriptSearch(focusedAgentId);

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
  } = useAgentTasks(client, status, focusedAgentId, allCronJobs);
  loadTasksRef.current = loadTasks;

  // Capture transcripts from completed cron/subagent sessions
  useTranscriptCapture(focusedAgentId);

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

  // ── Escape key closes mobile drawers ────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobilePane !== "chat") {
        e.preventDefault();
        setMobilePane("chat");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [mobilePane]);

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

  // When the selected agent changes, update settings to follow if the settings expanded tab is active
  useEffect(() => {
    if (!state.selectedAgentId) return;
    if (expandedTab === "settings" && state.selectedAgentId !== settingsAgentId) {
      setSettingsAgentId(state.selectedAgentId);
    } else if (settingsAgentId && state.selectedAgentId !== settingsAgentId) {
      setSettingsAgentId(null);
    }
  }, [expandedTab, settingsAgentId, setSettingsAgentId, state.selectedAgentId]);

  // Settings agent reset + cron/heartbeat loading handled by useSettingsPanel hook

  // Auto-close brain tab in context panel if no agents
  useEffect(() => {
    if (contextTab !== "brain" || contextMode !== "agent") return;
    if (selectedBrainAgentId) return;
    setContextTab("tasks");
  }, [contextMode, contextTab, selectedBrainAgentId]);

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
          type: "appendPart",
          agentId,
          part: { type: "text", text: `New session failed: ${message}` },
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
          type: "appendPart",
          agentId,
          part: { type: "text", text: "Error: Agent not found." },
        });
        return;
      }
      if (isResetCommand) {
        dispatch({
          type: "updateAgent",
          agentId,
          patch: { messageParts: [], streamText: null, thinkingTrace: null, lastResult: null },
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
        type: "appendPart",
        agentId,
        part: { type: "text", text: `> ${trimmed}` },
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
          type: "appendPart",
          agentId,
          part: { type: "text", text: `Error: ${msg}` },
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
          type: "appendPart",
          agentId,
          part: { type: "text", text: `Stop failed: ${message}` },
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
        setCronEventTick((prev) => prev + 1);
      },
      onActivityEvent: (sessionKey, data) => {
        // Resolve task name from cron job ID in session key (format: agent:<id>:cron:<jobId>:<ts>)
        let taskName: string | undefined;
        const cronMatch = sessionKey.match(/:cron:([^:]+)/);
        if (cronMatch) {
          const jobId = cronMatch[1];
          const job = allCronJobsRef.current.find((j) => j.id === jobId);
          if (job) taskName = job.name;
        }
        upsertLiveSession(sessionKey, { sessionKey, ...data, ...(taskName ? { taskName } : {}) });
      },
      onHeartbeatEvent: (entry) => {
        pushHeartbeatEntry(entry);
      },
      onSystemEvent: (event) => {
        addSystemEvent({
          id: `${event.kind}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          icon: event.kind === "exec-approval" ? "🔐" : event.kind === "cron-schedule" ? "⏰" : "📋",
          timestamp: Date.now(),
          ...event,
        });
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      onSubAgentLifecycle: (_sessionKey: string, _phase: string) => {
        // Sub-agent lifecycle tracking — available for future use
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

  // Responsive breakpoint for progressive layout
  const breakpoint = useBreakpoint();
  const showSidebarInline = isDesktopOrAbove(breakpoint); // ≥1024px
  const showContextInline = isWide(breakpoint) && contextPanelOpen; // ≥1440px + user hasn't closed it
  const isXlViewport = isWide(breakpoint); // activity drawer visibility
  const isMobileLayout = isTabletOrBelow(breakpoint); // <1024px

  // Swipe gestures for mobile drawer open/close
  const swipeHandlers = useSwipeDrawer({
    onSwipeRight: isMobileLayout
      ? () => {
          // Swipe right: open session history (if context drawer isn't open)
          if (mobilePane === "chat" && !mobileSessionDrawerOpen) {
            setMobileSessionDrawerOpen(true);
          }
          // Swipe right on context drawer: close it
          if (mobilePane === "context") {
            setMobilePane("chat");
          }
        }
      : undefined,
    onSwipeLeft: isMobileLayout
      ? () => {
          // Swipe left: open context panel (if session drawer isn't open)
          if (mobilePane === "chat" && !mobileSessionDrawerOpen) {
            setMobilePane("context");
          }
          // Swipe left on session drawer: close it
          if (mobileSessionDrawerOpen) {
            setMobileSessionDrawerOpen(false);
          }
        }
      : undefined,
  });

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
    <Suspense fallback={null}>
    <div className="relative w-screen overflow-hidden bg-background" style={{ minHeight: '100dvh' }}>
      {state.loading ? (
        <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-50 flex justify-center px-3">
          <div className="bg-card rounded-lg px-6 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Loading agents…
          </div>
        </div>
      ) : null}
      <div className="relative flex w-full flex-col overflow-hidden bg-background" style={{ height: '100dvh' }}>
        <div className="w-full">
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
              setExpandedTab("settings");
            }}
            agents={breadcrumbAgents}
            selectedAgentId={focusedAgentId}
            onSelectAgent={(agentId) => {
              flushPendingDraft(focusedAgent?.agentId ?? null);
              dispatch({ type: "selectAgent", agentId });
            }}
            gatewayVersion={gatewayVersion}
            gatewayUptime={gatewayUptime}
          />
        </div>

        {connectionPanelVisible ? (
          <div className="w-full">
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
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            {/* Backdrop for mobile context drawer */}
            {mobilePane !== "chat" && !showContextInline ? (
              <div
                className="fixed inset-0 z-40 bg-black/50"
                onClick={switchToChat}
              />
            ) : null}
            {/* Mobile session history overlay drawer */}
            {mobileSessionDrawerOpen && !showSidebarInline ? (
              <div
                className="fixed inset-0 z-50"
                onClick={() => setMobileSessionDrawerOpen(false)}
              >
                <div className="absolute inset-0 bg-black/50" />
                <div
                  className="absolute inset-y-0 left-0 w-[240px] animate-in slide-in-from-left duration-200"
                  onClick={(e) => e.stopPropagation()}
                >
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
            ) : null}
            {/* Session history sidebar — desktop only, collapsible */}
            <div className={`${showSidebarInline ? "flex flex-[0_0_auto] min-h-0" : "hidden"}`}>
              <SessionHistorySidebar
                client={client}
                status={status}
                agentId={focusedAgentId}
                activeSessionKey={viewingSessionKey ?? (focusedAgent ? `${focusedAgent.agentId}:main` : null)}
                onSelectSession={(key) => setViewingSessionKey(key === `${focusedAgentId}:main` ? null : key)}
                onNewSession={stableChatOnNewSession}
                collapsed={sessionSidebarCollapsed}
                onToggleCollapse={() => setSessionSidebarCollapsed((p) => !p)}
              />
            </div>
            <div
              className="flex min-h-0 flex-1 overflow-hidden bg-background"
              data-testid="focused-agent-panel"
              {...swipeHandlers}
            >
              <ActivityDrawer hidden={!isXlViewport} agentId={focusedAgentId} client={client} status={status} cronJobs={allCronJobs}>
              {focusedAgent ? (
                <AgentChatPanel
                  agent={focusedAgent}
                  canSend={status === "connected"}
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
              </ActivityDrawer>
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
                      <ProjectsPanel agentId={focusedAgent?.agentId ?? null} client={client} isTabActive eventTick={cronEventTick} requestCreateProject={createProjectTick} />
                    )}
                    {expandedTab === "tasks" && (
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
                      />
                    )}
                    {expandedTab === "brain" && (
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
                    )}
                    {expandedTab === "workspace" && (
                      <WorkspaceExplorerPanel
                        client={client}
                        agentId={focusedAgent?.agentId ?? null}
                        isTabActive
                        eventTick={cronEventTick}
                      />
                    )}
                    {expandedTab === "sessions" && (
                      <SessionsPanel
                        client={client}
                        sessions={allSessions}
                        loading={allSessionsLoading}
                        error={allSessionsError}
                        onRefresh={() => { void loadAllSessions(); }}
                        activeSessionKey={focusedAgent?.sessionKey ?? null}
                        aggregateUsage={aggregateUsage}
                        aggregateUsageLoading={aggregateUsageLoading}
                        cumulativeUsage={aggregateUsageFromList ? {
                          inputTokens: aggregateUsageFromList.inputTokens,
                          outputTokens: aggregateUsageFromList.outputTokens,
                          totalCost: null,
                          messageCount: aggregateUsageFromList.messageCount,
                        } : null}
                        cumulativeUsageLoading={allSessionsLoading}
                        usageByType={usageByType}
                        transcripts={transcripts}
                        transcriptsLoading={transcriptsLoading}
                        transcriptsLoadingMore={transcriptsLoadingMore}
                        transcriptsError={transcriptsError}
                        transcriptsHasMore={transcriptsHasMore}
                        onTranscriptsRefresh={transcriptsRefresh}
                        onTranscriptsLoadMore={transcriptsLoadMore}
                        searchQuery={searchQuery}
                        onSearchQueryChange={setSearchQuery}
                        searchResults={searchResults}
                        searchLoading={searchLoading}
                        searchError={searchError}
                        onClearSearch={clearSearch}
                        onViewTrace={handleViewTrace}
                        onTranscriptClick={(sessionId, agentId) => {
                          setExpandedTab(null);
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
                        }}
                      />
                    )}
                    {expandedTab === "usage" && (
                      <UsagePanel client={client} status={status} />
                    )}
                    {expandedTab === "channels" && (
                      <ChannelsPanel
                        snapshot={channelsSnapshot}
                        loading={channelsLoading}
                        error={channelsError}
                        onRefresh={() => { void loadChannelsStatus(); }}
                        hideHeader
                      />
                    )}
                    {expandedTab === "cron" && (
                      <CronPanel
                        client={client}
                        cronJobs={allCronJobs}
                        loading={allCronLoading}
                        error={allCronError}
                        runBusyJobId={allCronRunBusyJobId}
                        deleteBusyJobId={allCronDeleteBusyJobId}
                        toggleBusyJobId={allCronToggleBusyJobId}
                        onRunJob={(jobId) => { void handleAllCronRunJob(jobId); }}
                        onDeleteJob={(jobId) => { void handleAllCronDeleteJob(jobId); }}
                        onToggleEnabled={(jobId) => { void handleAllCronToggleEnabled(jobId); }}
                        onRefresh={() => { void loadAllCronJobs(); }}
                      />
                    )}
                    {expandedTab === "settings" && settingsAgent && (
                      <AgentSettingsPanel
                        key={settingsAgent.agentId}
                        agent={settingsAgent}
                        onClose={clearExpandedTab}
                        onRename={(name) => handleRenameAgent(settingsAgent.agentId, name)}
                        onNewSession={() => handleNewSession(settingsAgent.agentId)}
                        onDelete={() => handleDeleteAgent(settingsAgent.agentId)}
                        canDelete={settingsAgent.agentId !== RESERVED_MAIN_AGENT_ID}
                        onToolCallingToggle={(enabled) => handleToolCallingToggle(settingsAgent.agentId, enabled)}
                        onThinkingTracesToggle={(enabled) => handleThinkingTracesToggle(settingsAgent.agentId, enabled)}
                        cronJobs={settingsCronJobs}
                        cronLoading={settingsCronLoading}
                        cronError={settingsCronError}
                        cronRunBusyJobId={cronRunBusyJobId}
                        cronDeleteBusyJobId={cronDeleteBusyJobId}
                        onRunCronJob={(jobId) => handleRunCronJob(settingsAgent.agentId, jobId)}
                        onDeleteCronJob={(jobId) => handleDeleteCronJob(settingsAgent.agentId, jobId)}
                        cronToggleBusyJobId={cronToggleBusyJobId}
                        onToggleCronJob={(jobId, enabled) => handleToggleCronJob(settingsAgent.agentId, jobId, enabled)}
                        heartbeats={settingsHeartbeats}
                        heartbeatLoading={settingsHeartbeatLoading}
                        heartbeatError={settingsHeartbeatError}
                        heartbeatRunBusyId={heartbeatRunBusyId}
                        heartbeatDeleteBusyId={heartbeatDeleteBusyId}
                        onRunHeartbeat={(heartbeatId) => handleRunHeartbeat(settingsAgent.agentId, heartbeatId)}
                        onDeleteHeartbeat={(heartbeatId) => handleDeleteHeartbeat(settingsAgent.agentId, heartbeatId)}
                        onRetryCron={reloadCronJobs}
                        onRetryHeartbeats={reloadHeartbeats}
                        onNavigateToTasks={() => setContextTab("tasks")}
                      />
                    )}
                  </div>
                </ExpandedContext.Provider>
              </PanelExpandModal>
            )}
            {/* Trace Viewer overlay */}
            {viewingTrace && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="h-[90vh] w-full max-w-6xl">
                  <TraceViewer
                    agentId={viewingTrace.agentId}
                    sessionId={viewingTrace.sessionId}
                    onClose={clearViewingTrace}
                  />
                </div>
              </div>
            )}
            {/* Collapsed context panel strip — visible on wide when panel is closed */}
            {isWide(breakpoint) && !contextPanelOpen && (
              <ContextPanelStrip
                activeTab={contextTab}
                onOpen={(tab) => {
                  if (tab) setContextTab(tab);
                  setContextPanelOpen(true);
                }}
              />
            )}
            {/* Context Panel: agent-scoped (Tasks/Brain/Settings) or global (Files) */}
            <div
              className={`${showContextInline ? "static flex shrink-0 flex-none w-[360px] translate-x-0" : `fixed inset-y-0 right-0 z-50 w-[360px] transform transition-transform duration-300 ${mobilePane === "context" ? "translate-x-0" : "translate-x-full"}`} bg-[var(--surface-elevated)] min-h-0 overflow-hidden p-0 border-l border-border/20`}
            >
              {contextMode === "files" ? (
                <ArtifactsPanel isSelected />
              ) : (
                <ContextPanel
                  activeTab={contextTab}
                  expandedTab={expandedTab === "projects" || expandedTab === "tasks" || expandedTab === "brain" || expandedTab === "workspace" ? expandedTab : null}
                  onExpandToggle={handleExpandToggle}
                  onClose={showContextInline ? () => setContextPanelOpen(false) : undefined}
                  onTabChange={setContextTab}
                  projectsContent={
                    <div className="flex h-full w-full flex-col overflow-y-auto">
                      <ProjectsPanel
                        agentId={focusedAgent?.agentId ?? null}
                        client={client}
                        isTabActive={contextTab === "projects"}
                        eventTick={cronEventTick}
                        requestCreateProject={createProjectTick}
                      />
                    </div>
                  }
                  tasksContent={
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
                        />
                    </div>
                  }
                  brainContent={
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
                  }
                  workspaceContent={
                    <WorkspaceExplorerPanel
                      key={focusedAgent?.agentId ?? "none"}
                      agentId={focusedAgent?.agentId ?? null}
                      client={client}
                      isTabActive={contextTab === "workspace"}
                      eventTick={cronEventTick}
                    />
                  }
                />
              )}
            </div>
          </div>
        ) : (
          <div className="bg-background rounded-xl fade-up-delay flex min-h-0 flex-1 flex-col overflow-hidden p-5 sm:p-6">
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
    </div>
    </Suspense>
  );
};

export default function Home() {
  return (
    <AgentStoreProvider>
      <AgentStudioPage />
    </AgentStoreProvider>
  );
}
