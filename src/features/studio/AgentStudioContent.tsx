"use client";

// Navigation: Desktop uses FloatingContextControls (top-right pill).
// Mobile uses MobileBottomNav (thumb-reachable bottom bar) + MobileSessionDrawer.

import { Suspense } from "react";
import { AgentChatPanel } from "@/features/agents/components/AgentChatPanel";
import { AppSidebar } from "@/layout/AppSidebar";
import { FloatingContextControls } from "@/features/studio/FloatingContextControls";
import { MobileBottomNav } from "@/features/studio/MobileBottomNav";
import { EmptyStatePanel } from "@/features/agents/components/EmptyStatePanel";
import { Users } from "lucide-react";
import { ManagementPanelContent } from "@/components/ManagementPanelContent";
import { ManagementDrawer } from "@/components/ManagementDrawer";
import { ManagementPanelProvider } from "@/components/management/ManagementPanelContext";
import { TraceViewer } from "@/features/sessions/components/TraceViewer";
import { ReplayView } from "@/features/sessions/components/ReplayView";
import { ForkTree } from "@/features/sessions/components/ForkTree";
import { EmergencyProvider } from "@/features/emergency/EmergencyProvider";
import { isWide } from "@/hooks/useBreakpoint";
import { StudioLayout } from "@/layout/StudioLayout";
import { StudioExpandedPanel } from "@/features/studio/StudioExpandedPanel";
import { StudioModals } from "@/features/studio/StudioModals";
import { StudioLoadingScreen } from "@/features/studio/StudioLoadingScreen";
import { StudioStatusBanners } from "@/features/studio/StudioStatusBanners";
import { StudioContextDrawer } from "@/features/studio/StudioContextDrawer";
import { MobileSessionDrawer } from "@/features/studio/MobileSessionDrawer";

import { useStudioOrchestrator } from "@/features/studio/useStudioOrchestrator";

export const AgentStudioPage = () => {
  const o = useStudioOrchestrator();
  const {
    client, status, gatewayUrl, connect,
    layout, state, dispatch, agents, focusedAgent, focusedAgentId,
    hasAnyAgents, showFleetLayout, agentsLoadedOnce, errorMessage,
    flushPendingDraft, gatewayModels, stableChatTokenLimit,
    commandPalette, breadcrumbAgents, handleManagementNav,
    agentTasks, tasksLoading, tasksError, busyTaskId, busyAction,
    toggleTask, updateTask, updateTaskSchedule, runTask, deleteTask, loadTasks,
    cronMaxConcurrentRuns, cronEventTick, createProjectTick,
    wizard, handleStartWizard, handleWizardConfirm, wizardConfirming, wizardCreationResult, wizardCreationSteps, clearWizardCreationResult,
    stopBusyAgentId, isOffline, queueLength,
    viewingSessionKey, viewingSessionHistory, viewingTrace,
    viewingSessionLoading, viewingSessionError, retryTranscript,
    clearViewingTrace, viewingReplay, clearViewingReplay,
    viewingForkTree, clearViewingForkTree, handleViewForkTree,
    stableChatOnModelChange, stableChatOnThinkingChange,
    stableChatOnDraftChange, stableChatOnSend, stableChatOnStopRun,
    stableChatOnNewSession, stableChatOnExitSessionView,
    stableChatOnDismissContinuation, stableChatTokenUsed,
    handleViewTrace, handleViewReplay, handleSidebarSessionSelect,
    handleExpandedTranscriptClick, handleResumeSession, handleExportSession,
    sessionContinuedAgents,
    configMutationStatusLine,
    createAgentBlock, createBlockStatusLine,
    renameAgentBlock, renameBlockStatusLine,
    deleteAgentBlock, deleteBlockStatusLine,
    deleteConfirmAgentId, setDeleteConfirmAgentId, handleConfirmDeleteAgent,
    managementPanelProps, forkTreeInfo,
  } = o;

  const {
    breakpoint, showSidebarInline, showContextInline, showContextSlideOver, isMobileLayout,
    mobilePane, setMobilePane,
    sessionSidebarCollapsed, setSessionSidebarCollapsed,
    mobileSessionDrawerOpen, setMobileSessionDrawerOpen,
    contextPanelOpen, setContextPanelOpen,
    contextTab, setContextTab,
    expandedTab, setExpandedTab,
    managementView, setManagementView,
    headerVisible, onHoverZoneEnter, onHoverZoneLeave, onFocusZoneEnter, onFocusZoneLeave,
    handleExpandToggle, clearExpandedTab, switchToChat,
    swipeHandlers, swipeDy,
  } = layout;

  if (status === "connecting" || (status === "connected" && !agentsLoadedOnce)) {
    return <StudioLoadingScreen status={status} />;
  }

  // ── Shared chat panel props ──────────────────────────────────────
  const chatPanelProps = focusedAgent ? {
    agent: focusedAgent,
    composerAgents: breadcrumbAgents,
    onSelectAgent: (agentId: string) => {
      flushPendingDraft(focusedAgent?.agentId ?? null);
      dispatch({ type: "selectAgent", agentId });
    },
    canSend: status === "connected" || isOffline,
    gatewayStatus: status,
    queueLength,
    models: gatewayModels,
    stopBusy: stopBusyAgentId === focusedAgent.agentId,
    onModelChange: stableChatOnModelChange,
    onThinkingChange: stableChatOnThinkingChange,
    onDraftChange: stableChatOnDraftChange,
    onSend: stableChatOnSend,
    onStopRun: stableChatOnStopRun,
    onNewSession: stableChatOnNewSession,
    tokenUsed: stableChatTokenUsed,
    tokenLimit: stableChatTokenLimit,
    viewingSessionKey,
    viewingSessionHistory,
    viewingSessionLoading,
    viewingSessionError,
    onRetryTranscript: retryTranscript,
    onExitSessionView: stableChatOnExitSessionView,
    sessionContinued: sessionContinuedAgents.has(focusedAgent.agentId),
    onDismissContinuationBanner: stableChatOnDismissContinuation,
    wizard,
    onWizardConfirm: () => void handleWizardConfirm(),
    wizardConfirming,
    wizardCreationResult,
    wizardCreationSteps,
    onDismissWizardResult: clearWizardCreationResult,
    onOpenCredentialVault: () => setManagementView("credentials"),
    onOpenSettings: () => handleManagementNav("personas"),
    onLaunchWizard: handleStartWizard,
  } : null;

  // ── Shared sidebar props ─────────────────────────────────────────
  const sidebarProps = {
    client,
    status,
    agentId: focusedAgentId,
    activeSessionKey: viewingSessionKey ?? (focusedAgent ? `${focusedAgent.agentId}:main` : null),
    onSelectSession: (key: string) => key === `${focusedAgentId}:main` ? handleSidebarSessionSelect(null) : handleSidebarSessionSelect(key),
    onNewSession: stableChatOnNewSession,
    collapsed: sessionSidebarCollapsed,
    onToggleCollapse: () => setSessionSidebarCollapsed((p: boolean) => !p),
    onManagementNav: handleManagementNav,
    activeManagementTab: managementView,
    onViewTrace: (key: string) => handleViewTrace(key, focusedAgentId),
    onViewReplay: (key: string) => handleViewReplay(key, focusedAgentId),
    onResume: handleResumeSession,
    onViewForkTree: handleViewForkTree,
  };

  // ── Shared context drawer props ──────────────────────────────────
  const contextDrawerProps = {
    activeTab: contextTab,
    expandedTab: expandedTab as "projects" | "tasks" | "workspace" | "skills" | "activity" | "budget" | "router" | "playground" | null,
    onExpandToggle: handleExpandToggle,
    onClose: () => setContextPanelOpen(false),
    onTabChange: setContextTab,
    switchToChat,
    hideTabBar: false,
    focusedAgentId: focusedAgent?.agentId ?? null,
    client,
    cronEventTick,
    createProjectTick,
    agentTasks,
    tasksLoading,
    tasksError,
    busyTaskId,
    busyAction,
    onToggleTask: toggleTask,
    onUpdateTask: updateTask,
    onUpdateTaskSchedule: updateTaskSchedule,
    onRunTask: runTask,
    onDeleteTask: deleteTask,
    onRefreshTasks: () => { void loadTasks(); },
    onNewTask: () => handleStartWizard("task"),
    cronMaxConcurrentRuns,
    status,
    agents,
    gatewayModels,
    focusedAgent,
    onCreateSkill: () => handleStartWizard("skill"),
  };

  // ── Management drawer ────────────────────────────────────────────
  const managementTitle = managementView
    ? ({ usage: "Usage", channels: "Channels", credentials: "Credentials", models: "Models", gateway: "Gateway", cron: "Cron", contacts: "Contacts", voice: "Voice", personas: "Personas" } as Record<string, string>)[managementView] ?? ""
    : "";

  // ── Empty state ──────────────────────────────────────────────────
  const emptyAgentPanel = (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
      <Users className="h-10 w-10 opacity-30" />
      <p className="text-sm">
        {hasAnyAgents ? "No agents match this filter." : "No agents available."}
      </p>
      {!hasAnyAgents && (
        <p className="text-xs text-muted-foreground">
          Use New Agent in the sidebar to add your first agent.
        </p>
      )}
    </div>
  );

  return (
    <EmergencyProvider>
    <ManagementPanelProvider {...managementPanelProps}>
    <Suspense fallback={null}>
    <div className="relative w-screen overflow-hidden bg-background" style={{ height: '100svh' }}>
      {state.loading ? (
        <div className="pointer-events-none fixed bottom-4 left-0 right-0 z-50 flex justify-center px-3">
          <div className="bg-card rounded-lg px-6 py-3 font-sans text-xs uppercase tracking-[0.14em] text-muted-foreground">
            Loading agents…
          </div>
        </div>
      ) : null}
      <div className="relative h-full w-full overflow-hidden bg-background">
        {/* Header hover zone */}
        <div
          className="fixed inset-x-0 top-0 z-30 h-3"
          onMouseEnter={onHoverZoneEnter}
          onMouseLeave={onHoverZoneLeave}
          onFocus={onFocusZoneEnter}
          onBlur={onFocusZoneLeave}
        />
        {/* Floating context controls — desktop */}
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
        {/* Mobile bottom nav */}
        {!isWide(breakpoint) && (
          <MobileBottomNav
            onOpenSessionDrawer={() => setMobileSessionDrawerOpen(true)}
            contextTab={contextTab}
            contextPanelOpen={contextPanelOpen}
            contextPaneVisible={isMobileLayout ? mobilePane === "context" && contextPanelOpen : contextPanelOpen}
            onContextTabClick={(tab) => {
              if (contextPanelOpen && contextTab === tab) {
                setContextPanelOpen(false);
              } else {
                setContextTab(tab);
                setContextPanelOpen(true);
              }
              if (isMobileLayout && mobilePane !== "context") setMobilePane("context");
            }}
            visible={headerVisible}
          />
        )}

        <StudioStatusBanners
          errorMessage={errorMessage}
          configMutationStatusLine={configMutationStatusLine}
          status={status}
          onReconnect={() => void connect()}
        />

        {showFleetLayout ? (
          <div className="absolute inset-0">
            {/* Mobile context backdrop */}
            {mobilePane !== "chat" && !showContextInline ? (
              <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={switchToChat} />
            ) : null}
            {/* Mobile session drawer */}
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
                onResume={handleResumeSession}
                onViewForkTree={handleViewForkTree}
              />
            ) : null}

            {/* ── Wide: 3-column resizable layout ─────────── */}
            {isWide(breakpoint) ? (
              <StudioLayout
                breakpoint={breakpoint}
                sidebarCollapsed={sessionSidebarCollapsed}
                contextPanelOpen={contextPanelOpen}
                onContextPanelOpenChange={setContextPanelOpen}
                onSidebarCollapsedChange={setSessionSidebarCollapsed}
                leftSidebar={<AppSidebar {...sidebarProps} />}
                centerChat={
                  <>
                    <ManagementDrawer
                      open={managementView !== null}
                      onOpenChange={(open) => { if (!open) setManagementView(null); }}
                      title={managementTitle}
                      sidebarOffsetPx={0}
                    >
                      <ManagementPanelContent tab={managementView} />
                    </ManagementDrawer>
                    {chatPanelProps ? <AgentChatPanel {...chatPanelProps} /> : emptyAgentPanel}
                  </>
                }
                rightPanel={
                  <StudioContextDrawer renderMode="panel" isMobileLayout={false} showContextInline={true} mobilePane="chat" swipeDy={0} swipeHandlers={{}} {...contextDrawerProps} />
                }
              />
            ) : (
              <>
                {/* Sidebar — non-wide desktop: floating overlay */}
                <div className={`${showSidebarInline ? "fixed inset-y-0 left-0 z-20 flex" : "hidden"}`}>
                  <AppSidebar {...sidebarProps} />
                </div>
                {/* Chat canvas */}
                <div className="absolute inset-0 z-0 flex overflow-hidden" data-testid="focused-agent-panel" {...swipeHandlers}>
                  <ManagementDrawer
                    open={managementView !== null}
                    onOpenChange={(open) => { if (!open) setManagementView(null); }}
                    title={managementTitle}
                    sidebarOffsetPx={sessionSidebarCollapsed ? 56 : 288}
                  >
                    <ManagementPanelContent tab={managementView} />
                  </ManagementDrawer>
                  {chatPanelProps ? <AgentChatPanel {...chatPanelProps} /> : emptyAgentPanel}
                </div>
              </>
            )}
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
              onTranscriptClick={handleExpandedTranscriptClick}
              gatewayModels={gatewayModels}
              defaultModel={focusedAgent?.model ?? (gatewayModels.length > 0 ? `${gatewayModels[0].provider}/${gatewayModels[0].id}` : undefined)}
              onCreateSkill={() => handleStartWizard("skill")}
              onNavigateToPlayground={() => {
                setContextTab("playground");
                setExpandedTab("playground");
              }}
            />
            {/* Trace Viewer overlay */}
            {viewingTrace && (
              <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="h-[90vh] w-full max-w-6xl">
                  <TraceViewer agentId={viewingTrace.agentId} sessionId={viewingTrace.sessionId} onClose={clearViewingTrace} />
                </div>
              </div>
            )}
            {/* Replay View overlay */}
            {viewingReplay && (
              <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="h-[90vh] w-full max-w-6xl">
                  <ReplayView agentId={viewingReplay.agentId} sessionId={viewingReplay.sessionId} onClose={clearViewingReplay} client={client} />
                </div>
              </div>
            )}
            {/* Fork Tree overlay */}
            {viewingForkTree && forkTreeInfo.tree && (
              <div className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <div className="h-[80vh] w-full max-w-3xl">
                  <ForkTree
                    tree={forkTreeInfo.tree}
                    activeSessionKey={viewingForkTree}
                    onSelectSession={(key) => { clearViewingForkTree(); handleSidebarSessionSelect(key); }}
                    onClose={clearViewingForkTree}
                  />
                </div>
              </div>
            )}
            {/* Context panel: overlay for non-wide viewports */}
            {!isWide(breakpoint) && (
              <StudioContextDrawer isMobileLayout={isMobileLayout} showContextInline={showContextInline} showContextSlideOver={showContextSlideOver} mobilePane={mobilePane} swipeDy={swipeDy} swipeHandlers={swipeHandlers} {...contextDrawerProps} />
            )}
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

export default AgentStudioPage;
