"use client";

/**
 * useStudioOrchestrator — facade hook that consolidates all Studio hook calls.
 *
 * Reduces AgentStudioContent from 1400+ LOC to pure layout by encapsulating
 * gateway, agent, chat, task, wizard, layout, and data-sync hooks.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { BreadcrumbAgent } from "@/features/agents/components/ComposerAgentMenu";
import type { ManagementTab } from "@/layout/AppSidebar";
import type { ContextTab } from "@/features/context/components/ContextPanel";
import type { FocusFilter } from "@/features/agents/state/store";
import type { CreateTaskPayload } from "@/features/tasks/types";
import type { WizardType } from "@/features/wizards/lib/wizardTypes";
import type { PersonaTemplate } from "@/features/personas/lib/templateTypes";

import { useGateway } from "@/lib/gateway/GatewayProvider";
import {
  getFilteredAgents,
  getSelectedAgent,
  useAgentStore,
} from "@/features/agents/state/store";
import { createGatewayRuntimeEventHandler } from "@/features/agents/state/gatewayRuntimeEventHandler";
import { useAgentTasks } from "@/features/tasks/hooks/useAgentTasks";
import { useExecApprovalContext } from "@/features/exec-approvals/ExecApprovalProvider";
import { useCommandPalette } from "@/features/command-palette/hooks/useCommandPalette";
import { useForkTree } from "@/features/sessions/hooks/useForkTree";
import { useChannelsStatus } from "@/features/channels/hooks/useChannelsStatus";
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
import { useSettingsPanel } from "@/features/agents/hooks/useSettingsPanel";
import { useChatCallbacks } from "@/features/agents/hooks/useChatCallbacks";
import { useAppLayout } from "@/hooks/useAppLayout";
import { useLoadAgents } from "@/features/studio/useLoadAgents";
import { useStudioDataSync } from "@/features/studio/useStudioDataSync";
import { useWizardInChat } from "@/features/wizards/hooks/useWizardInChat";
import { useWizardIntentBridge } from "@/features/wizards/hooks/useWizardIntentBridge";
import {
  buildTaskWizardPrompt,
  buildAgentWizardPrompt,
  getDefaultWizardPrompt,
} from "@/features/wizards/lib/wizardPrompts";
import { buildPersonaBuilderPrompt } from "@/features/personas/lib/personaBuilderPrompt";
import { executeWizardCreation } from "@/features/wizards/lib/wizardCreation";
import { createGatewayAgent } from "@/lib/gateway/agentCrud";
import { exportConversationAsMarkdown } from "@/features/sessions/lib/exportConversation";
import { toast } from "sonner";

export function useStudioOrchestrator() {
  // ═══════════════════════════════════════════════════════════════════
  // Gateway & Connection
  // ═══════════════════════════════════════════════════════════════════
  const {
    client,
    status,
    gatewayUrl,
    connect,
    settingsCoordinator,
  } = useGateway();

  // ═══════════════════════════════════════════════════════════════════
  // Agent Store
  // ═══════════════════════════════════════════════════════════════════
  const { state, dispatch, hydrateAgents, setError, setLoading } = useAgentStore();

  // ═══════════════════════════════════════════════════════════════════
  // Layout
  // ═══════════════════════════════════════════════════════════════════
  const layout = useAppLayout();

  // ═══════════════════════════════════════════════════════════════════
  // Local State
  // ═══════════════════════════════════════════════════════════════════
  const [focusFilter, setFocusFilter] = useState<FocusFilter>("all");
  const [focusedPreferencesLoaded, setFocusedPreferencesLoaded] = useState(false);
  const stateRef = useRef(state);
  const focusFilterTouchedRef = useRef(false);
  const sessionsUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cronUpdateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadTasksRef = useRef<() => Promise<any>>(() => Promise.resolve());
  const cronJobNameResolverRef = useRef<(cronJobId: string) => string | undefined>(() => undefined);
  const loadChannelsStatusRef = useRef<() => Promise<void>>(() => Promise.resolve());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadAgentHistoryRef = useRef<(agentId: string) => Promise<any>>(() => Promise.resolve());
  const refreshHeartbeatLatestUpdateRef = useRef<() => void>(() => {});
  const loadSessionUsageRef = useRef<(key: string) => Promise<void>>(() => Promise.resolve());
  const [stopBusyAgentId, setStopBusyAgentId] = useState<string | null>(null);
  const [cronEventTick, setCronEventTick] = useState(0);
  const [agentContextWindow, setAgentContextWindow] = useState<Map<string, { totalTokens: number; contextTokens: number }>>(new Map());
  const runtimeEventHandlerRef = useRef<ReturnType<typeof createGatewayRuntimeEventHandler> | null>(null);
  const handleStartWizardRef = useRef<((type: WizardType) => void) | null>(null);
  const [createProjectTick, setCreateProjectTick] = useState(0);

  // ═══════════════════════════════════════════════════════════════════
  // Gateway Models
  // ═══════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════
  // Exec Approvals
  // ═══════════════════════════════════════════════════════════════════
  const {
    setQueue: setExecApprovalQueue,
    reset: resetExecApprovals,
  } = useExecApprovalContext();

  // ═══════════════════════════════════════════════════════════════════
  // Channels & Session Usage
  // ═══════════════════════════════════════════════════════════════════
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

  useNotificationEvaluator(client, status);

  loadChannelsStatusRef.current = loadChannelsStatus;

  // ═══════════════════════════════════════════════════════════════════
  // Draft & Live Patch Batching
  // ═══════════════════════════════════════════════════════════════════
  const { flushPendingDraft, handleDraftChange, pendingDraftValuesRef, pendingDraftTimersRef } =
    useDraftBatching(dispatch);
  const { queueLivePatch, clearPendingLivePatch } = useLivePatchBatching(dispatch);

  // ═══════════════════════════════════════════════════════════════════
  // Derived Agent State
  // ═══════════════════════════════════════════════════════════════════
  const agents = state.agents;
  const {
    settingsAgentId, setSettingsAgentId, settingsAgent,
  } = useSettingsPanel({ status, agents });
  const selectedAgent = useMemo(() => getSelectedAgent(state), [state]);
  const filteredAgents = useMemo(
    () => getFilteredAgents(state, focusFilter),
    [focusFilter, state],
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
  const focusedAgentRef = useRef(focusedAgent);
  focusedAgentRef.current = focusedAgent;

  const errorMessage = state.error ?? gatewayModelsError;
  const runningAgentCount = useMemo(
    () => agents.filter((agent) => agent.status === "running").length,
    [agents],
  );
  const hasRunningAgents = runningAgentCount > 0;
  const hasAnyAgents = agents.length > 0;
  const showFleetLayout = hasAnyAgents || status === "connected";

  // ═══════════════════════════════════════════════════════════════════
  // Command Palette & Navigation
  // ═══════════════════════════════════════════════════════════════════
  const handleManagementNav = useCallback((tab: ManagementTab) => {
    if (tab === "personas" && focusedAgent && !settingsAgentId) {
      setSettingsAgentId(focusedAgent.agentId);
    }
    layout.setManagementView((prev) => (prev === tab ? null : tab));
  }, [focusedAgent, settingsAgentId, setSettingsAgentId, layout]);

  const handleCmdNavTab = useCallback((tab: ContextTab | "usage" | "channels" | "personas") => {
    const contextTabs = new Set<string>(["projects", "tasks", "workspace", "activity", "router", "playground"]);
    if (contextTabs.has(tab)) {
      layout.setContextTab(tab as ContextTab);
      layout.setContextPanelOpen(true);
      if (layout.mobilePane !== "context") layout.setMobilePane("context");
    } else {
      if (tab === "personas" && focusedAgent && !settingsAgentId) {
        setSettingsAgentId(focusedAgent.agentId);
      }
      layout.setManagementView(tab as ManagementTab);
    }
  }, [layout, focusedAgent, settingsAgentId, setSettingsAgentId]);

  const handleCmdOpenCtx = useCallback(() => layout.setContextPanelOpen(true), [layout]);

  const handleCmdSwitchAgent = useCallback((agentId: string) => {
    flushPendingDraft(focusedAgent?.agentId ?? null);
    dispatch({ type: "selectAgent", agentId });
  }, [flushPendingDraft, focusedAgent?.agentId, dispatch]);

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

  // ═══════════════════════════════════════════════════════════════════
  // Breadcrumbs
  // ═══════════════════════════════════════════════════════════════════
  const breadcrumbAgents: BreadcrumbAgent[] = useMemo(
    () => agents.map((a) => ({
      agentId: a.agentId,
      name: a.name,
      status: a.status,
      model: a.model,
      avatarSeed: a.avatarSeed,
      avatarUrl: a.avatarUrl,
    })),
    [agents],
  );

  // ═══════════════════════════════════════════════════════════════════
  // Tasks
  // ═══════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════
  // Wizard
  // ═══════════════════════════════════════════════════════════════════
  const wizard = useWizardInChat({
    client,
    agentId: focusedAgentId ?? "default",
  });

  useWizardIntentBridge({
    messageParts: focusedAgent?.messageParts ?? [],
    isWizardActive: wizard.wizardContext != null,
    startWizard: wizard.startWizard,
    agentId: focusedAgentId,
  });

  const handleStartWizard = useCallback(
    (type: WizardType) => {
      if (type === "task") {
        const prompt = buildTaskWizardPrompt("periodic", agents.map((a) => a.agentId));
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
        wizard.startWizard(type, getDefaultWizardPrompt(type));
      }
      if (layout.isMobileLayout) {
        layout.setMobilePane("chat");
      }
    },
    [agents, wizard, layout],
  );
  handleStartWizardRef.current = handleStartWizard;

  const handleSelectTemplate = useCallback(
    (template: PersonaTemplate) => {
      const prompt = buildPersonaBuilderPrompt({
        template,
        existingAgents: agents.map((a) => ({ id: a.agentId, name: a.name ?? a.agentId })),
      });
      wizard.startWizard("persona", prompt);
      setTimeout(() => {
        wizard.sendMessage(`Create a ${template.name} persona using the ${template.name} template. Let's get started!`);
      }, 100);
      if (layout.isMobileLayout) {
        layout.setMobilePane("chat");
      }
    },
    [agents, wizard, layout],
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
        // Error shown by task creation flow
      }
      return;
    }

    if (extracted.type === "persona") {
      try {
        const { extractBrainFiles, extractKnowledgeFiles, extractJsonBlock } = await import("@/features/wizards/lib/artifactExtractor");
        const personaConfig = extractJsonBlock<{ personaId: string; displayName: string; purpose?: string; roleDescription?: string }>(extracted.sourceText, "persona-config");
        const rawBrainFiles = extractBrainFiles(extracted.sourceText);
        const knowledgeFiles = extractKnowledgeFiles(extracted.sourceText);

        if (!personaConfig?.personaId || !personaConfig?.displayName) {
          toast.error("Persona configuration incomplete — missing personaId or displayName");
          return;
        }

        const brainFiles: Record<string, string> = {};
        for (const [filename, content] of Object.entries(rawBrainFiles)) {
          brainFiles[filename.replace(/\.md$/i, "").toLowerCase()] = content;
        }

        const res = await fetch("/api/agents/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: personaConfig.personaId,
            name: personaConfig.displayName,
            purpose: personaConfig.purpose ?? personaConfig.roleDescription ?? "AI persona",
            brainFiles,
            knowledgeFiles,
          }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Unknown error" }));
          toast.error(`Persona creation failed: ${(err as { error?: string }).error ?? res.statusText}`);
          return;
        }

        try {
          await createGatewayAgent({ client, name: personaConfig.displayName });
        } catch (gwErr) {
          console.warn("[persona] Gateway agent registration failed:", gwErr);
        }

        const ownerAgentId = focusedAgent?.agentId ?? "alex";
        const personaDbRes = await fetch("/api/workspace/personas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: ownerAgentId,
            personaId: personaConfig.personaId,
            displayName: personaConfig.displayName,
            category: (personaConfig as Record<string, unknown>).category ?? "operations",
            templateKey: (personaConfig as Record<string, unknown>).templateKey ?? null,
            optimizationGoals: (personaConfig as Record<string, unknown>).optimizationGoals ?? [],
          }),
        });
        if (!personaDbRes.ok) {
          console.warn("[persona] DB row creation failed:", await personaDbRes.text().catch(() => ""));
        }

        await fetch("/api/workspace/personas", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: ownerAgentId,
            personaId: personaConfig.personaId,
            status: "active",
          }),
        }).catch(() => { /* non-fatal */ });

        const pcAny = personaConfig as Record<string, unknown>;
        if (pcAny.voiceId) {
          await fetch("/api/workspace/personas", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              personaId: personaConfig.personaId,
              voiceProvider: "elevenlabs",
              voiceId: pcAny.voiceId,
              voiceModelId: pcAny.voiceModelId ?? "eleven_flash_v2_5",
              voiceStability: pcAny.voiceStability ?? 0.5,
              voiceClarity: pcAny.voiceClarity ?? 0.75,
              voiceStyle: pcAny.voiceStyle ?? 0,
            }),
          }).catch(() => { /* non-fatal */ });
        }

        void wizard.endWizard();
        toast.success(`Persona "${personaConfig.displayName}" created and activated`);
      } catch (err) {
        toast.error(`Persona creation failed: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
      return;
    }

    const agentId = focusedAgent?.agentId;
    if (!agentId) return;

    try {
      const result = await executeWizardCreation(extracted.type, extracted.config, client, agentId);
      if (result.success) {
        void wizard.endWizard();
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (err) {
      toast.error(`Wizard creation failed: ${err instanceof Error ? err.message : "An unknown error occurred."}`);
    }
  }, [wizard, createTask, loadTasks, focusedAgent, client]);

  // ═══════════════════════════════════════════════════════════════════
  // Task & Cron Refs
  // ═══════════════════════════════════════════════════════════════════
  loadTasksRef.current = loadTasks;
  cronJobNameResolverRef.current = (cronJobId: string) =>
    agentTasks.find((t) => t.cronJobId === cronJobId)?.name;

  // ═══════════════════════════════════════════════════════════════════
  // Special Updates & Focus Filter
  // ═══════════════════════════════════════════════════════════════════
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
    [flushPendingDraft, focusedAgent],
  );

  // ═══════════════════════════════════════════════════════════════════
  // Model Matching
  // ═══════════════════════════════════════════════════════════════════
  const findModelMatch = useCallback(
    (modelKey: string | undefined | null) => {
      if (!modelKey) return undefined;
      return gatewayModels.find(
        (m) => `${m.provider}/${m.id}` === modelKey || m.id === modelKey,
      );
    },
    [gatewayModels],
  );

  // ═══════════════════════════════════════════════════════════════════
  // Load Agents
  // ═══════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════
  // Data Sync
  // ═══════════════════════════════════════════════════════════════════
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
    expandedTab: layout.expandedTab,
    managementView: layout.managementView,
    contextTab: layout.contextTab,
    contextMode: "agent" as const,
    setContextTab: layout.setContextTab,
  });

  // ═══════════════════════════════════════════════════════════════════
  // Config Mutation Queue (create/rename/delete agents)
  // ═══════════════════════════════════════════════════════════════════
  const enqueueConfigMutationRef = useRef<(params: {
    kind: "create-agent" | "rename-agent" | "delete-agent";
    label: string;
    run: () => Promise<void>;
  }) => Promise<void>>(async () => {});

  const stableEnqueueConfigMutation = useCallback(
    (params: { kind: "create-agent" | "rename-agent" | "delete-agent"; label: string; run: () => Promise<void> }) =>
      enqueueConfigMutationRef.current(params),
    [],
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
    setMobilePane: layout.setMobilePane,
    isBusy: false,
  });

  const { createAgentBlock } = useCreateAgent({
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
    setMobilePane: layout.setMobilePane,
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
    setMobilePane: layout.setMobilePane,
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

  useEffect(() => {
    enqueueConfigMutationRef.current = enqueueConfigMutation;
  }, [enqueueConfigMutation]);

  // ═══════════════════════════════════════════════════════════════════
  // History Sync
  // ═══════════════════════════════════════════════════════════════════
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

  // Keep stateRef current (synchronous during render, not useEffect)
  stateRef.current = state;

  // ═══════════════════════════════════════════════════════════════════
  // Initial Load Effect
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (status !== "connected" || !focusedPreferencesLoaded) return;
    if (deleteAgentBlock && deleteAgentBlock.phase !== "queued") return;
    if (createAgentBlock && createAgentBlock.phase !== "queued") return;
    if (renameAgentBlock && renameAgentBlock.phase !== "queued") return;
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

  // Sync selected agent with focused agent
  useEffect(() => {
    const nextId = focusedAgent?.agentId ?? null;
    if (state.selectedAgentId === nextId) return;
    dispatch({ type: "selectAgent", agentId: nextId });
  }, [dispatch, focusedAgent, state.selectedAgentId]);

  // ═══════════════════════════════════════════════════════════════════
  // Chat Callbacks
  // ═══════════════════════════════════════════════════════════════════
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
    setMobilePane: layout.setMobilePane,
    stopBusyAgentId,
    setStopBusyAgentId,
  });

  const { isOffline, queueLength, enqueue } = useOfflineQueue(client, status, handleSend);

  // ═══════════════════════════════════════════════════════════════════
  // Runtime Event Subscription
  // ═══════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════
  // Studio Chat Callbacks (stable wrappers)
  // ═══════════════════════════════════════════════════════════════════
  const {
    viewingSessionKey,
    viewingSessionHistory,
    viewingTrace,
    viewingSessionLoading,
    viewingSessionError,
    retryTranscript,
    clearViewingTrace,
    viewingReplay,
    clearViewingReplay,
    viewingForkTree,
    clearViewingForkTree,
    handleViewForkTree,
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
    handleResumeSession,
  } = useStudioChatCallbacks({
    client,
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
    setMobilePane: layout.setMobilePane,
    setManagementView: layout.setManagementView,
    clearExpandedTab: layout.clearExpandedTab,
    setSessionContinuedAgents,
  });

  // ═══════════════════════════════════════════════════════════════════
  // Management Panel Props
  // ═══════════════════════════════════════════════════════════════════
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
    onCloseSettings: layout.handleBackToChat,
    onRenameAgent: (name: string) => settingsAgent ? handleRenameAgent(settingsAgent.agentId, name) : Promise.resolve(false),
    onNewSession: () => { if (settingsAgent) handleNewSession(settingsAgent.agentId); },
    onDeleteAgent: () => { if (settingsAgent) handleDeleteAgent(settingsAgent.agentId); },
    onToolCallingToggle: (enabled: boolean) => { if (settingsAgent) handleToolCallingToggle(settingsAgent.agentId, enabled); },
    onThinkingTracesToggle: (enabled: boolean) => { if (settingsAgent) handleThinkingTracesToggle(settingsAgent.agentId, enabled); },
    onAutonomyChange: (level: Parameters<typeof handleAutonomyChange>[1]) => { if (settingsAgent) void handleAutonomyChange(settingsAgent.agentId, level); },
    onNavigateToTasks: () => layout.setContextTab("tasks"),
    onTranscriptClick: handleDrawerTranscriptClick,
    onStartCredentialWizard: () => {
      layout.setManagementView(null);
      handleStartWizard("credential");
    },
  }), [
    client, status, focusedAgentId,
    focusedAgent?.sessionKey, handleViewTrace, handleDrawerTranscriptClick,
    channelsSnapshot, channelsLoading, channelsError, loadChannelsStatus,
    settingsAgent, layout, handleRenameAgent, handleNewSession,
    handleDeleteAgent, handleToolCallingToggle, handleThinkingTracesToggle, handleAutonomyChange,
    handleStartWizard,
  ]);

  // ═══════════════════════════════════════════════════════════════════
  // Export & Fork Tree
  // ═══════════════════════════════════════════════════════════════════
  const handleExportSession = useCallback(
    (key: string) => {
      if (!focusedAgentId) return;
      void exportConversationAsMarkdown(focusedAgentId, key, key).catch((err) =>
        console.error("Export failed:", err),
      );
    },
    [focusedAgentId],
  );

  const forkTreeInfo = useForkTree(viewingForkTree ?? null);

  const stableChatTokenLimit = useMemo(() => {
    if (!focusedAgent) return undefined;
    const cw = agentContextWindow.get(focusedAgent.agentId);
    if (cw && cw.contextTokens > 0) return cw.contextTokens;
    return findModelMatch(focusedAgent.model)?.contextWindow;
  }, [focusedAgent, agentContextWindow, findModelMatch]);

  // ═══════════════════════════════════════════════════════════════════
  // Config Mutation Status Lines
  // ═══════════════════════════════════════════════════════════════════
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

  // ═══════════════════════════════════════════════════════════════════
  // Wizard Event Listener
  // ═══════════════════════════════════════════════════════════════════
  useEffect(() => {
    const handler = () => {
      handleStartWizardRef.current?.("task");
    };
    window.addEventListener("openclaw:launch-task-wizard", handler);
    return () => window.removeEventListener("openclaw:launch-task-wizard", handler);
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // Return structured orchestrator
  // ═══════════════════════════════════════════════════════════════════
  return {
    // Gateway
    client,
    status,
    gatewayUrl,
    connect,

    // Layout
    layout,

    // Agent state
    state,
    dispatch,
    agents,
    focusedAgent,
    focusedAgentId,
    focusedAgentRef,
    hasAnyAgents,
    showFleetLayout,
    agentsLoadedOnce,
    errorMessage,
    flushPendingDraft,

    // Models
    gatewayModels,
    stableChatTokenLimit,

    // Command palette
    commandPalette,
    breadcrumbAgents,
    handleManagementNav,

    // Tasks
    agentTasks,
    tasksLoading,
    tasksError,
    busyTaskId,
    busyAction,
    toggleTask,
    updateTask,
    updateTaskSchedule,
    runTask,
    deleteTask,
    loadTasks,
    cronMaxConcurrentRuns,
    cronEventTick,
    createProjectTick,

    // Wizard
    wizard,
    handleStartWizard,
    handleSelectTemplate,
    handleWizardConfirm,

    // Chat
    stopBusyAgentId,
    isOffline,
    queueLength,
    viewingSessionKey,
    viewingSessionHistory,
    viewingTrace,
    viewingSessionLoading,
    viewingSessionError,
    retryTranscript,
    clearViewingTrace,
    viewingReplay,
    clearViewingReplay,
    viewingForkTree,
    clearViewingForkTree,
    handleViewForkTree,
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
    handleExpandedTranscriptClick,
    handleResumeSession,
    handleExportSession,
    sessionContinuedAgents,

    // Config mutations
    configMutationStatusLine,
    createAgentBlock,
    createBlockStatusLine,
    renameAgentBlock,
    renameBlockStatusLine,
    deleteAgentBlock,
    deleteBlockStatusLine,
    deleteConfirmAgentId,
    setDeleteConfirmAgentId,
    handleConfirmDeleteAgent,
    handleDeleteAgent,

    // Settings
    settingsAgent,
    handleRenameAgent,
    handleNewSession,
    handleToolCallingToggle,
    handleThinkingTracesToggle,
    handleAutonomyChange,

    // Management panel
    managementPanelProps,

    // Fork tree
    forkTreeInfo,

    // Focus filter (unused but kept for Phase 6 FleetSidebar removal)
    handleFocusFilterChange,
  };
}
