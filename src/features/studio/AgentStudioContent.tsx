"use client";

// Navigation: Desktop uses FloatingContextControls (top-right pill).
// Mobile uses MobileBottomNav (thumb-reachable bottom bar) + MobileSessionDrawer.

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";
// AgentBrainPanel moved to StudioContextDrawer
import { AppSidebar, type ManagementTab } from "@/layout/AppSidebar";
import type { BreadcrumbAgent } from "@/features/agents/components/AgentBreadcrumb";
import { FloatingContextControls } from "@/features/studio/FloatingContextControls";
import { MobileBottomNav } from "@/features/studio/MobileBottomNav";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
// BrandMark moved to StudioLoadingScreen
// GatewayStatusBanner moved to StudioStatusBanners
import { Users } from "lucide-react";
import { useGateway } from "@/lib/gateway/GatewayProvider";
import {
  getFilteredAgents,
  getSelectedAgent,
  type FocusFilter,
  useAgentStore,
} from "@/features/agents/state/store";
import { createGatewayRuntimeEventHandler } from "@/features/agents/state/gatewayRuntimeEventHandler";
// settingsCoordinator accessed via useGateway() context
// TasksPanel + ProjectsPanel moved to StudioContextDrawer
import { useAgentTasks } from "@/features/tasks/hooks/useAgentTasks";
import type { CreateTaskPayload } from "@/features/tasks/types";
// ContextPanel moved to StudioContextDrawer
import type { ContextTab } from "@/features/context/components/ContextPanel";

// PanelErrorBoundary moved to StudioContextDrawer
import { ManagementPanelContent } from "@/components/ManagementPanelContent";
import { ManagementDrawer } from "@/components/ManagementDrawer";
import { ManagementPanelProvider } from "@/components/management/ManagementPanelContext";
import { useExecApprovalContext } from "@/features/exec-approvals/ExecApprovalProvider";
import { useCommandPalette } from "@/features/command-palette/hooks/useCommandPalette";
// UnifiedFilesPanel + ActivityPanel moved to StudioContextDrawer
// Heartbeat entries now routed exclusively via onActivityMessage to useActivityMessageStore
import { TraceViewer } from "@/features/sessions/components/TraceViewer";
import { ReplayView } from "@/features/sessions/components/ReplayView";
import { useChannelsStatus } from "@/features/channels/hooks/useChannelsStatus";

import { EmergencyProvider } from "@/features/emergency/EmergencyProvider";
import { useNotificationEvaluator } from "@/features/notifications/hooks/useNotificationEvaluator";
import { useSessionUsage } from "@/features/sessions/hooks/useSessionUsage";
import { useGatewayStatus } from "@/lib/gateway/useGatewayStatus";
import { useConfigMutationQueue } from "@/features/agents/hooks/useConfigMutationQueue";
import { useDraftBatching } from "@/features/agents/hooks/useDraftBatching";
import { useLivePatchBatching } from "@/features/agents/hooks/useLivePatchBatching";
import { useSpecialUpdates } from "@/features/agents/hooks/useSpecialUpdates";
import { useAgentHistorySync } from "@/features/agents/hooks/useAgentHistorySync";
import { useDeleteAgent } from "@/features/agents/hooks/useDeleteAgent";
import { useCreateAgent } from "@/features/agents/hooks/useCreateAgent";
import { useRenameAgent } from "@/features/agents/hooks/useRenameAgent";
import { useOfflineQueue } from "@/lib/gateway/useOfflineQueue";
import { useGatewayModels } from "@/features/agents/hooks/useGatewayModels";
import { useRuntimeEventSubscription } from "@/features/studio/useRuntimeEventSubscription";
import { useStudioChatCallbacks } from "@/features/studio/useStudioChatCallbacks";
import { MobileSessionDrawer } from "@/features/studio/MobileSessionDrawer";
import { exportConversationAsMarkdown } from "@/features/sessions/lib/exportConversation";
import { StudioExpandedPanel } from "@/features/studio/StudioExpandedPanel";
import { StudioModals } from "@/features/studio/StudioModals";
import { StudioLoadingScreen } from "@/features/studio/StudioLoadingScreen";
import { StudioStatusBanners } from "@/features/studio/StudioStatusBanners";
import { StudioContextDrawer } from "@/features/studio/StudioContextDrawer";
import { useSettingsPanel } from "@/features/agents/hooks/useSettingsPanel";
import { useChatCallbacks } from "@/features/agents/hooks/useChatCallbacks";
import { isWide } from "@/hooks/useBreakpoint";
import { useAppLayout } from "@/hooks/useAppLayout";

import { useLoadAgents } from "@/features/studio/useLoadAgents";
import { useStudioDataSync } from "@/features/studio/useStudioDataSync";
import { useWizardInChat } from "@/features/wizards/hooks/useWizardInChat";
import { useWizardIntentBridge } from "@/features/wizards/hooks/useWizardIntentBridge";
import { buildTaskWizardPrompt, buildAgentWizardPrompt, getDefaultWizardPrompt } from "@/features/wizards/lib/wizardPrompts";
import type { WizardType } from "@/features/wizards/lib/wizardTypes";
import type { PersonaTemplate } from "@/features/personas/lib/templateTypes";
import { buildPersonaBuilderPrompt } from "@/features/personas/lib/personaBuilderPrompt";
import { executeWizardCreation } from "@/features/wizards/lib/wizardCreation";
import { toast } from "sonner";

export const AgentStudioPage = () => {
  const {
    client,
    status,
    gatewayUrl,
    connect,
    settingsCoordinator,
  } = useGateway();

  const { state, dispatch, hydrateAgents, setError, setLoading } = useAgentStore();
  const layout = useAppLayout();
  const {
    breakpoint, showSidebarInline, showContextInline, isMobileLayout, isTabletLayout,
    mobilePane, setMobilePane,
    sessionSidebarCollapsed, setSessionSidebarCollapsed,
    mobileSessionDrawerOpen, setMobileSessionDrawerOpen,
    contextPanelOpen, setContextPanelOpen,
    setContextMode,
    contextTab, setContextTab,
    expandedTab,
    brainFileTab, setBrainFileTab,
    brainPreviewMode, setBrainPreviewMode,
    managementView, setManagementView,
    headerVisible, onHoverZoneEnter, onHoverZoneLeave, onFocusZoneEnter, onFocusZoneLeave,
    handleExpandToggle, clearExpandedTab, switchToChat,
    handleFilesToggle: _handleFilesToggle, handleBackToChat,
    swipeHandlers,
    swipeDy,
  } = layout;
  // Legacy wizard modals removed — all wizards now render inline via useWizardInChat
  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");
  const [focusedPreferencesLoaded, setFocusedPreferencesLoaded] = useState(false);
  const stateRef = useRef(state);
  const focusFilterTouchedRef = useRef(false);
  const sessionsUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cronUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable refs for load functions — avoids useEffect dependency cascades that
  // cause event handler teardown/recreation loops and RPC call storms.
  // Initialized with no-ops; updated after their hooks define them below.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadTasksRef = useRef<() => Promise<any>>(() => Promise.resolve());
  /** Resolve a cron job ID to its display name via enriched tasks data. */
  const cronJobNameResolverRef = useRef<(cronJobId: string) => string | undefined>(() => undefined);
  const loadChannelsStatusRef = useRef<() => Promise<void>>(() => Promise.resolve());
  // loadCumulativeUsageRef removed — sessions.usage aggregate eliminated (P0 perf fix)
  // loadSummarySnapshotRef + refreshContextWindowRef provided by useStudioDataSync
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadAgentHistoryRef = useRef<(agentId: string) => Promise<any>>(() => Promise.resolve());
  const refreshHeartbeatLatestUpdateRef = useRef<() => void>(() => {});
  const loadSessionUsageRef = useRef<(key: string) => Promise<void>>(() => Promise.resolve());
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


  // Listen for task wizard launch events from credential post-save flow
  const handleStartWizardRef = useRef<((type: WizardType) => void) | null>(null);
  useEffect(() => {
    const handler = () => {
      handleStartWizardRef.current?.("task");
    };
    window.addEventListener("openclaw:launch-task-wizard", handler);
    return () => window.removeEventListener("openclaw:launch-task-wizard", handler);
  }, []);

  /** Context window utilization per agent — totalTokens = last turn's prompt size, contextTokens = model limit */
  const [agentContextWindow, setAgentContextWindow] = useState<Map<string, { totalTokens: number; contextTokens: number }>>(new Map());
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
    loadGatewayStatus, parsePresenceFromStatus, resetPresence,
  } = useGatewayStatus(client, status);

  const {
    sessionUsage,
    loadSessionUsage, resetSessionUsage,
  } = useSessionUsage(client, status);

  // P0: sessions.usage aggregate RPC eliminated — use aggregateTokensFromList instead
  // (sessions.usage was taking 1-8 seconds and causing slow consumer disconnects)

  // Emergency state moved to EmergencyProvider

  useNotificationEvaluator(client, status);

  // Keep load-function refs current (avoids stale closures)
  // eslint-disable-next-line react-hooks/refs
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

  const handleCmdNavTab = useCallback((tab: ContextTab | "usage" | "channels" | "settings") => {
    const contextTabs = new Set<string>(["projects", "tasks", "brain", "workspace", "activity", "router", "playground"]);
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

  // ── Wizard-in-chat ────────────────────────────────────────────────
  const wizard = useWizardInChat({
    client,
    agentId: focusedAgentId ?? "default",
  });

  // Bridge: detect agent tool calls that trigger wizards
  useWizardIntentBridge({
    messageParts: focusedAgent?.messageParts ?? [],
    isWizardActive: wizard.wizardContext != null,
    startWizard: wizard.startWizard,
    agentId: focusedAgentId,
  });

  const handleStartWizard = useCallback(
    (type: WizardType) => {
      if (type === "task") {
        const prompt = buildTaskWizardPrompt(
          "periodic",
          agents.map((a) => a.agentId),
        );
        wizard.startWizard("task", prompt);
      } else if (type === "agent") {
        const prompt = buildAgentWizardPrompt(
          agents.map((a) => ({ id: a.agentId, name: a.name ?? a.agentId })),
        );
        wizard.startWizard("agent", prompt);
      } else if (type === "persona") {
        const prompt = buildPersonaBuilderPrompt({
          existingAgents: agents.map((a) => ({ id: a.agentId, name: a.name ?? a.agentId })),
        });
        wizard.startWizard("persona", prompt);
      } else {
        // project, skill, credential — use default prompts
        wizard.startWizard(type, getDefaultWizardPrompt(type));
      }
      // Ensure we're on the chat pane (mobile)
      if (isMobileLayout) {
        setMobilePane("chat");
      }
    },
    [agents, wizard, isMobileLayout, setMobilePane],
  );
  // eslint-disable-next-line react-hooks/refs
  handleStartWizardRef.current = handleStartWizard;

  /** Start the persona wizard with a specific template pre-loaded */
  const handleSelectTemplate = useCallback(
    (template: PersonaTemplate) => {
      const prompt = buildPersonaBuilderPrompt({
        template,
        existingAgents: agents.map((a) => ({ id: a.agentId, name: a.name ?? a.agentId })),
      });
      wizard.startWizard("persona", prompt);
      if (isMobileLayout) {
        setMobilePane("chat");
      }
    },
    [agents, wizard, isMobileLayout, setMobilePane],
  );

  const handleWizardConfirm = useCallback(async () => {
    const extracted = wizard.extractedConfig;
    if (!extracted) return;

    if (extracted.type === "task") {
      try {
        await createTask(extracted.config as CreateTaskPayload);
        void wizard.endWizard();
        void loadTasks();
      } catch {
        // Error is shown by the task creation flow
      }
      return;
    }

    // Persona creation — uses artifact extraction for brain + knowledge files
    if (extracted.type === "persona") {
      try {
        const { extractBrainFiles, extractKnowledgeFiles, extractJsonBlock } = await import("@/features/wizards/lib/artifactExtractor");
        const personaConfig = extractJsonBlock<{ personaId: string; displayName: string; purpose: string }>(extracted.sourceText, "persona-config");
        const brainFiles = extractBrainFiles(extracted.sourceText);
        const knowledgeFiles = extractKnowledgeFiles(extracted.sourceText);

        if (!personaConfig?.personaId || !personaConfig?.displayName) {
          toast.error("Persona configuration incomplete — missing personaId or displayName");
          return;
        }

        const res = await fetch("/api/agents/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: personaConfig.personaId,
            name: personaConfig.displayName,
            purpose: personaConfig.purpose ?? "AI persona",
            brainFiles,
            knowledgeFiles,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          toast.error(`Persona creation failed: ${(err as { error?: string }).error ?? res.statusText}`);
          return;
        }
        void wizard.endWizard();
        toast.success(`Persona "${personaConfig.displayName}" created successfully`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        toast.error(`Persona creation failed: ${msg}`);
      }
      return;
    }

    // Skill, credential, project, agent — handled by wizardCreation
    const agentId = focusedAgent?.agentId;
    if (!agentId) return;

    try {
      const result = await executeWizardCreation(
        extracted.type,
        extracted.config,
        client,
        agentId,
      );
      if (result.success) {
        void wizard.endWizard();
        toast.success(result.message);
        // Credential wizard signals UI to open setup sheet
        if (result.openCredentialSetup) {
          // Future: open credential sheet with pre-filled template
          // For now, the user completes setup in the Credentials panel
        }
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An unknown error occurred.";
      toast.error(`Wizard creation failed: ${msg}`);
    }
  }, [wizard, createTask, loadTasks, focusedAgent, client]);

  // eslint-disable-next-line react-hooks/refs
  loadTasksRef.current = loadTasks;
  // eslint-disable-next-line react-hooks/refs
  cronJobNameResolverRef.current = (cronJobId: string) =>
    agentTasks.find((t) => t.cronJobId === cronJobId)?.name;

  // Capture transcripts from completed cron/subagent sessions
  const focusedAgentRef = useRef(focusedAgent);
  // eslint-disable-next-line react-hooks/refs
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

  // eslint-disable-next-line react-hooks/refs
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

  // Connect/disconnect resets, context window refresh, session usage loading,
  // session key change detection, and turn-complete reloads handled by useStudioDataSync

  // Favicon effect handled by useStudioDataSync
  // resolveAgentName + resolveAgentAvatarUrl extracted to useLoadAgents

  const { loadAgents, agentsLoadedOnce, setAgentsLoadedOnce } = useLoadAgents({
    dispatch,
    hydrateAgents,
    setError,
    setLoading,
    gatewayConfigSnapshot,
    setGatewayConfigSnapshot,
    resolveDefaultModelForAgent,
    setAgentContextWindow,
  });

  const {
    loadSummarySnapshotRef,
    sessionContinuedAgents,
    setSessionContinuedAgents,
  } = useStudioDataSync({
    client,
    status,
    dispatch,
    stateRef,
    agents,
    selectedAgentId: state.selectedAgentId,
    focusedAgentId,
    focusedSessionKey: focusedAgent?.sessionKey ?? null,
    focusedAgentStatus: focusedAgent?.status ?? null,
    hasRunningAgents,
    selectedBrainAgentId,
    loadSessionUsageRef,
    loadGatewayStatus,
    parsePresenceFromStatus,
    resetChannelsStatus,
    resetExecApprovals,
    resetPresence,
    resetSessionUsage,
    loadSessionUsage,
    setAgentContextWindow,
    loadAgents,
    agentsLoadedOnce,
    setAgentsLoadedOnce,
    setLoading,
    settingsCoordinator,
    settingsAgentId,
    setSettingsAgentId,
    gatewayUrl,
    focusFilter,
    setFocusFilter,
    focusFilterTouchedRef,
    focusedPreferencesLoaded,
    setFocusedPreferencesLoaded,
    expandedTab,
    managementView,
    contextTab,
    contextMode: "agent" as const,
    setContextTab,
  });

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

  // eslint-disable-next-line react-hooks/refs
  loadAgentHistoryRef.current = loadAgentHistory;

  // Update stateRef synchronously during render (not in useEffect) so that
  // WebSocket event handlers reading stateRef.current always see the latest
  // dispatched state, not the state from the previous render cycle.
  // eslint-disable-next-line react-hooks/refs
  stateRef.current = state;

  // agentsLoadedOnce reset, focus preferences, settings coordinator handled by useStudioDataSync

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

  // Disconnect loading reset, settings agent follow, brain tab auto-close handled by useStudioDataSync
  // Settings agent reset + cron/heartbeat loading handled by useSettingsPanel hook
  // Model loading is handled by useGatewayModels hook

  // loadSummarySnapshot, summary polling, and agent selection sync handled by useStudioDataSync

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
    handleAutonomyChange,
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

  useRuntimeEventSubscription({
    client,
    status,
    dispatch,
    stateRef,
    queueLivePatch,
    clearPendingLivePatch,
    runtimeEventHandlerRef,
    sessionsUpdateTimerRef,
    cronUpdateTimerRef,
    loadSummarySnapshotRef,
    loadAgentHistoryRef,
    refreshHeartbeatLatestUpdateRef,
    loadChannelsStatusRef,
    loadTasksRef,
    cronJobNameResolverRef,
    bumpHeartbeatTick,
    updateSpecialLatestUpdate,
    setExecApprovalQueue,
    setCronEventTick,
  });

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

  // ── Stable callbacks extracted to useStudioChatCallbacks ──
  const {
    viewingSessionKey,
    viewingSessionHistory,
    viewingTrace,
    viewingSessionLoading,
    clearViewingTrace,
    viewingReplay,
    clearViewingReplay,
    stableChatOnModelChange,
    stableChatOnThinkingChange,
    stableChatOnDraftChange,
    stableChatOnSend,
    stableChatOnStopRun,
    stableChatOnNewSession,
    stableChatOnExitSessionView,
    stableChatOnDismissContinuation,
    stableChatTokenUsed,
    handleViewTrace,
    handleViewReplay,
    handleSidebarSessionSelect,
    handleDrawerTranscriptClick,
    handleExpandedTranscriptClick,
  } = useStudioChatCallbacks({
    focusedAgentRef,
    focusedAgent,
    handleModelChange,
    handleThinkingChange,
    handleDraftChange,
    handleSend,
    handleStopRun,
    handleNewSession,
    isOffline,
    enqueue,
    dispatch,
    agentContextWindow,
    sessionUsage,
    setMobilePane,
    setManagementView,
    clearExpandedTab,
    setSessionContinuedAgents,
  });

  // Shared management panel props — used by both ManagementDrawer and PanelExpandModal
  const managementPanelProps = useMemo(() => ({
    client,
    status,
    focusedAgentId,
    activeSessionKey: focusedAgent?.sessionKey ?? null,
    onViewTrace: handleViewTrace,
    channelsSnapshot,
    channelsLoading,
    channelsError,
    onRefreshChannels: () => { void loadChannelsStatus(); },
    settingsAgent: settingsAgent ?? null,
    onCloseSettings: handleBackToChat,
    onRenameAgent: (name: string) => settingsAgent ? handleRenameAgent(settingsAgent.agentId, name) : Promise.resolve(false),
    onNewSession: () => { if (settingsAgent) handleNewSession(settingsAgent.agentId); },
    onDeleteAgent: () => { if (settingsAgent) handleDeleteAgent(settingsAgent.agentId); },
    onToolCallingToggle: (enabled: boolean) => { if (settingsAgent) handleToolCallingToggle(settingsAgent.agentId, enabled); },
    onThinkingTracesToggle: (enabled: boolean) => { if (settingsAgent) handleThinkingTracesToggle(settingsAgent.agentId, enabled); },
    onAutonomyChange: (level: Parameters<typeof handleAutonomyChange>[1]) => { if (settingsAgent) void handleAutonomyChange(settingsAgent.agentId, level); },
    onNavigateToTasks: () => setContextTab("tasks"),
    onTranscriptClick: handleDrawerTranscriptClick,
    onStartCredentialWizard: () => {
      setManagementView(null);
      handleStartWizard("credential");
    },
  }), [
    client, status, focusedAgentId,
    focusedAgent?.sessionKey, handleViewTrace, handleDrawerTranscriptClick,
    channelsSnapshot, channelsLoading, channelsError, loadChannelsStatus,
    settingsAgent, handleBackToChat, handleRenameAgent, handleNewSession,
    handleDeleteAgent, handleToolCallingToggle, handleThinkingTracesToggle, handleAutonomyChange,
    setContextTab, setManagementView, handleStartWizard,
  ]);

  const handleExportSession = useCallback(
    (key: string) => {
      if (!focusedAgentId) return;
      void exportConversationAsMarkdown(focusedAgentId, key, key).catch((err) =>
        console.error("Export failed:", err),
      );
    },
    [focusedAgentId],
  );

  const stableChatTokenLimit = useMemo(() => {
    if (!focusedAgent) return undefined;
    const cw = agentContextWindow.get(focusedAgent.agentId);
    if (cw && cw.contextTokens > 0) return cw.contextTokens;
    return findModelMatch(focusedAgent.model)?.contextWindow;
  }, [focusedAgent, agentContextWindow, findModelMatch]);

  if (status === "connecting" || (status === "connected" && !agentsLoadedOnce)) {
    return <StudioLoadingScreen status={status} />;
  }

  return (
    <EmergencyProvider>
    <ManagementPanelProvider {...managementPanelProps}>
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
        {/* ── Header hover zone: reveals floating controls on mouse enter ──────── */}
        <div
          className="fixed inset-x-0 top-0 z-30 h-3"
          onMouseEnter={onHoverZoneEnter}
          onMouseLeave={onHoverZoneLeave}
          onFocus={onFocusZoneEnter}
          onBlur={onFocusZoneLeave}
        />
        {/* ── Floating context controls — desktop (replaces HeaderBar) ──────── */}
        {isWide(breakpoint) && (
          <div
            onMouseEnter={onHoverZoneEnter}
            onMouseLeave={onHoverZoneLeave}
            onFocus={onFocusZoneEnter}
            onBlur={onFocusZoneLeave}
          >
            <FloatingContextControls
              agents={breadcrumbAgents}
              selectedAgentId={focusedAgentId}
              onSelectAgent={(agentId) => {
                flushPendingDraft(focusedAgent?.agentId ?? null);
                dispatch({ type: "selectAgent", agentId });
              }}
              onCreateAgent={() => handleStartWizard("agent")}
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
              visible={headerVisible}
            />
          </div>
        )}
        {/* ── Mobile bottom nav — unified thumb-reachable navigation ──────── */}
        {!isWide(breakpoint) && (
          <MobileBottomNav
            onOpenSessionDrawer={() => setMobileSessionDrawerOpen(true)}
            contextTab={contextTab}
            contextPanelOpen={contextPanelOpen}
            onContextTabClick={(tab) => {
              if (contextPanelOpen && contextTab === tab) {
                setContextPanelOpen(false);
              } else {
                setContextTab(tab);
                setContextPanelOpen(true);
              }
              // Only switch to context pane on mobile (tablet shows context inline)
              if (isMobileLayout && mobilePane !== "context") setMobilePane("context");
            }}
            visible={headerVisible}
          />
        )}

        {/* ── Status banners: fixed below floating controls ─────────── */}
        <StudioStatusBanners
          errorMessage={errorMessage}
          configMutationStatusLine={configMutationStatusLine}
          status={status}
          onReconnect={() => void connect()}
        />

        {showFleetLayout ? (
          <div className="absolute inset-0">
            {/* Backdrop for mobile context drawer */}
            {mobilePane !== "chat" && !showContextInline ? (
              <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
                onClick={switchToChat}
              />
            ) : null}
            {/* Mobile session history overlay drawer — includes management nav + session history */}
            {!showSidebarInline ? (
              <MobileSessionDrawer
                open={mobileSessionDrawerOpen}
                onClose={() => setMobileSessionDrawerOpen(false)}
                breadcrumbAgents={breadcrumbAgents}
                focusedAgentId={focusedAgentId}
                managementView={managementView}
                onManagementNav={handleManagementNav}
                onSelectAgent={(agentId) => {
                  flushPendingDraft(focusedAgent?.agentId ?? null);
                  dispatch({ type: "selectAgent", agentId });
                }}
                client={client}
                status={status}
                viewingSessionKey={viewingSessionKey}
                onSelectSession={handleSidebarSessionSelect}
                onNewSession={stableChatOnNewSession}
                onViewTrace={(key) => handleViewTrace(key, focusedAgentId)}
                onViewReplay={(key) => handleViewReplay(key, focusedAgentId)}
                onExport={handleExportSession}
              />
            ) : null}
            {/* App sidebar — desktop only, collapsible: floating overlay */}
            <div className={`${showSidebarInline ? "fixed inset-y-0 left-0 z-20 flex" : "hidden"}`}>
              <AppSidebar
                client={client}
                status={status}
                agentId={focusedAgentId}
                activeSessionKey={viewingSessionKey ?? (focusedAgent ? `${focusedAgent.agentId}:main` : null)}
                onSelectSession={(key) => key === `${focusedAgentId}:main` ? handleSidebarSessionSelect(null) : handleSidebarSessionSelect(key)}
                onNewSession={stableChatOnNewSession}
                collapsed={sessionSidebarCollapsed}
                onToggleCollapse={() => setSessionSidebarCollapsed((p) => !p)}
                onManagementNav={handleManagementNav}
                activeManagementTab={managementView}
                onViewTrace={(key) => handleViewTrace(key, focusedAgentId)}
                onViewReplay={(key) => handleViewReplay(key, focusedAgentId)}
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
                title={managementView ? ({ usage: "Usage", channels: "Channels", credentials: "Credentials", models: "Models", gateway: "Gateway", cron: "Cron", settings: "Settings", contacts: "Contacts" } as Record<ManagementTab, string>)[managementView] : ""}
                sidebarOffsetPx={sessionSidebarCollapsed ? 56 : 288}
              >
                <ManagementPanelContent
                  tab={managementView}
                />
              </ManagementDrawer>

              {focusedAgent ? (
                <AgentChatPanel
                  agent={focusedAgent}
                  composerAgents={breadcrumbAgents}
                  onSelectAgent={(agentId) => {
                    flushPendingDraft(focusedAgent?.agentId ?? null);
                    dispatch({ type: "selectAgent", agentId });
                  }}
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
                  wizard={wizard}
                  onWizardConfirm={() => void handleWizardConfirm()}
                  onOpenCredentialVault={() => setManagementView("credentials")}
                  onOpenSettings={() => handleManagementNav("settings")}
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
            <StudioExpandedPanel
              expandedTab={expandedTab}
              onClose={clearExpandedTab}
              focusedAgentId={focusedAgent?.agentId ?? null}
              client={client}
              status={status}
              cronEventTick={cronEventTick}
              createProjectTick={createProjectTick}
              agentTasks={agentTasks}
              tasksLoading={tasksLoading}
              tasksError={tasksError}
              busyTaskId={busyTaskId}
              busyAction={busyAction}
              onToggleTask={toggleTask}
              onUpdateTask={updateTask}
              onUpdateTaskSchedule={updateTaskSchedule}
              onRunTask={runTask}
              onDeleteTask={deleteTask}
              onRefreshTasks={() => { void loadTasks(); }}
              onNewTask={() => handleStartWizard("task")}
              cronMaxConcurrentRuns={cronMaxConcurrentRuns}
              agents={agents}
              selectedBrainAgentId={selectedBrainAgentId}
              brainFileTab={brainFileTab}
              onBrainFileTabChange={setBrainFileTab}
              brainPreviewMode={brainPreviewMode}
              onBrainPreviewModeChange={setBrainPreviewMode}
              onTranscriptClick={handleExpandedTranscriptClick}
              gatewayModels={gatewayModels}
              defaultModel={focusedAgent?.model ?? (gatewayModels.length > 0 ? `${gatewayModels[0].provider}/${gatewayModels[0].id}` : undefined)}
              onCreateSkill={() => handleStartWizard("skill")}
              onSelectTemplate={handleSelectTemplate}
            />
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
            {/* Replay View overlay */}
            {viewingReplay && (
              <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="h-[90vh] w-full max-w-6xl">
                  <ReplayView
                    agentId={viewingReplay.agentId}
                    sessionId={viewingReplay.sessionId}
                    onClose={clearViewingReplay}
                  />
                </div>
              </div>
            )}
            {/* Context tab cluster is now integrated into HeaderBar on wide viewports */}
            {/* Context Panel: floating overlay — bottom sheet on mobile, right panel on desktop */}
            <StudioContextDrawer
              isMobileLayout={isMobileLayout}
              showContextInline={showContextInline}
              mobilePane={mobilePane}
              swipeDy={swipeDy}
              swipeHandlers={swipeHandlers}
              contextTab={contextTab}
              expandedTab={expandedTab as "projects" | "tasks" | "brain" | "workspace" | "skills" | "activity" | "budget" | "router" | "playground" | null}
              onExpandToggle={handleExpandToggle}
              onClose={() => setContextPanelOpen(false)}
              onTabChange={setContextTab}
              switchToChat={switchToChat}
              hideTabBar={isWide(breakpoint)}
              focusedAgentId={focusedAgent?.agentId ?? null}
              client={client}
              cronEventTick={cronEventTick}
              createProjectTick={createProjectTick}
              agentTasks={agentTasks}
              tasksLoading={tasksLoading}
              tasksError={tasksError}
              busyTaskId={busyTaskId}
              busyAction={busyAction}
              onToggleTask={toggleTask}
              onUpdateTask={updateTask}
              onUpdateTaskSchedule={updateTaskSchedule}
              onRunTask={runTask}
              onDeleteTask={deleteTask}
              onRefreshTasks={() => { void loadTasks(); }}
              onNewTask={() => handleStartWizard("task")}
              cronMaxConcurrentRuns={cronMaxConcurrentRuns}
              agents={agents}
              selectedBrainAgentId={selectedBrainAgentId}
              brainFileTab={brainFileTab}
              onBrainFileTabChange={setBrainFileTab}
              brainPreviewMode={brainPreviewMode}
              onBrainPreviewModeChange={setBrainPreviewMode}
              status={status}
              gatewayModels={gatewayModels}
              modelValue={focusedAgent?.model ?? (gatewayModels.length > 0 ? `${gatewayModels[0].provider}/${gatewayModels[0].id}` : "")}
              onModelChange={stableChatOnModelChange}
              onBrainClose={() => {
                setContextMode("agent");
                setMobilePane("chat");
              }}
              focusedAgent={focusedAgent}
              onCreateSkill={() => handleStartWizard("skill")}
              onSelectTemplate={handleSelectTemplate}
            />
          </div>
        ) : (
          <div className="absolute inset-0 bg-background rounded-lg fade-up-delay flex flex-col overflow-hidden p-5 sm:p-6">
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
      <StudioModals
        commandPalette={commandPalette}
        agents={agents}
        createAgentBlock={createAgentBlock}
        createBlockStatusLine={createBlockStatusLine}
        renameAgentBlock={renameAgentBlock}
        renameBlockStatusLine={renameBlockStatusLine}
        deleteAgentBlock={deleteAgentBlock}
        deleteBlockStatusLine={deleteBlockStatusLine}
        deleteConfirmAgentId={deleteConfirmAgentId}
        onCancelDelete={() => setDeleteConfirmAgentId(null)}
        onConfirmDelete={(agentId) => { setDeleteConfirmAgentId(null); void handleConfirmDeleteAgent(agentId); }}
      />
    </div>
    </Suspense>
    </ManagementPanelProvider>
    </EmergencyProvider>
  );
};

