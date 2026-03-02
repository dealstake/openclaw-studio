import {
  memo,
  useCallback,
  useEffect,
  useRef,
} from "react";

import type { AgentState as AgentRecord } from "@/features/agents/state/store";
import type { MessagePart } from "@/lib/chat/types";
import { AlertTriangle, ArrowLeft, RefreshCw, X, Zap } from "lucide-react";
import { AutonomyLevelBadge } from "./AutonomyLevelSelector";
import type { AutonomyLevel } from "@/features/agents/lib/autonomyService";
import { DEFAULT_AUTONOMY_LEVEL } from "@/features/agents/lib/autonomyService";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { ChatAttachment } from "../hooks/useFileUpload";
import { AgentChatView } from "./AgentChatView";
import { EmptyStatePanel } from "./EmptyStatePanel";
import { AgentChatTranscript } from "./AgentChatTranscript";
import { AgentChatComposer } from "./AgentChatComposer";
import type { UseWizardInChatReturn } from "@/features/wizards/hooks/useWizardInChat";
import { WizardChatOverlay } from "@/features/wizards/components/WizardChatOverlay";
import type { ComposerAgent } from "./ComposerAgentMenu";

type AgentChatPanelProps = {
  agent: AgentRecord;
  /** Agent list for composer agent menu */
  composerAgents?: ComposerAgent[];
  onSelectAgent?: (agentId: string) => void;
  canSend: boolean;
  models: GatewayModelChoice[];
  stopBusy: boolean;
  onModelChange: (value: string | null) => void;
  onThinkingChange: (value: string | null) => void;
  onDraftChange: (value: string) => void;
  onSend: (message: string, attachments?: ChatAttachment[]) => void;
  onStopRun: () => void;
  tokenUsed?: number;
  tokenLimit?: number;
  onNewSession?: () => void;
  viewingSessionKey?: string | null;
  viewingSessionHistory?: MessagePart[];
  viewingSessionLoading?: boolean;
  onExitSessionView?: () => void;
  /** True when the agent's session key changed (session reset detected) */
  sessionContinued?: boolean;
  onDismissContinuationBanner?: () => void;
  /** Current gateway connection status for offline indicator */
  gatewayStatus?: GatewayStatus;
  /** Number of messages queued for offline delivery */
  queueLength?: number;
  /** Wizard-in-chat integration — pass from useWizardInChat hook */
  wizard?: UseWizardInChatReturn | null;
  /** Called when user confirms extracted wizard config */
  onWizardConfirm?: () => void;
  /** Whether wizard config confirmation is in progress */
  wizardConfirming?: boolean;
  /**
   * Called when the wizard's preflight check identifies a missing credential.
   * The parent (page.tsx) opens the credential vault for the given templateKey.
   */
  onOpenCredentialVault?: (templateKey: string) => void;
  /** Open agent settings panel — used by the autonomy badge click handler. */
  onOpenSettings?: () => void;
};

export const AgentChatPanel = memo(function AgentChatPanel({
  agent,
  composerAgents,
  onSelectAgent,
  canSend,
  models,
  stopBusy,
  onModelChange,
  onThinkingChange,
  onDraftChange,
  onSend,
  onStopRun,
  tokenUsed,
  tokenLimit,
  viewingSessionKey,
  viewingSessionHistory = [],
  viewingSessionLoading = false,
  onExitSessionView,
  sessionContinued = false,
  onDismissContinuationBanner,
  gatewayStatus,
  queueLength = 0,
  onNewSession,
  wizard = null,
  onWizardConfirm,
  wizardConfirming = false,
  onOpenCredentialVault,
  onOpenSettings,
}: AgentChatPanelProps) {
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollToBottomNextOutputRef = useRef(false);
  const plainDraftRef = useRef(agent.draft);

  // Escape key exits transcript viewer
  useEffect(() => {
    if (!viewingSessionKey || !onExitSessionView) return;
    const handler = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onExitSessionView();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [viewingSessionKey, onExitSessionView]);

  const resizeDraft = useCallback(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    const isMobile = window.matchMedia("(max-width: 639px)").matches;
    const cap = isMobile ? 80 : 160;
    const maxH = Math.min(el.scrollHeight, cap);
    el.style.height = `${maxH}px`;
    el.style.overflowY = el.scrollHeight > maxH ? "auto" : "hidden";
  }, []);

  const handleDraftRef = useCallback((el: HTMLTextAreaElement | HTMLInputElement | null) => {
    draftRef.current = el instanceof HTMLTextAreaElement ? el : null;
  }, []);

  const handleSend = useCallback(
    (message: string, attachments?: ChatAttachment[]) => {
      if (!canSend || agent.status === "running") return;
      const trimmed = message.trim();
      if (!trimmed && (!attachments || attachments.length === 0)) return;
      scrollToBottomNextOutputRef.current = true;
      onSend(trimmed || "(attached files)", attachments);
    },
    [agent.status, canSend, onSend]
  );

  const running = agent.status === "running";

  const handleComposerDraftChange = useCallback(
    (value: string) => {
      plainDraftRef.current = value;
      onDraftChange(value);
    },
    [onDraftChange]
  );

  const isWizardActive = !!(wizard?.wizardContext);

  const handleWizardSend = useCallback(
    (text: string) => {
      if (wizard?.wizardContext) {
        void wizard.sendMessage(text);
      }
    },
    [wizard],
  );

  const handleWizardExit = useCallback(() => {
    if (wizard) {
      void wizard.endWizard();
    }
  }, [wizard]);

  const handleWizardRevise = useCallback(() => {
    if (wizard?.wizardContext) {
      void wizard.sendMessage("Please revise the configuration based on my feedback.");
    }
  }, [wizard]);

  const handleWizardStarterClick = useCallback(
    (message: string) => {
      if (wizard?.wizardContext) {
        void wizard.sendMessage(message);
      }
    },
    [wizard],
  );

  // ── Preflight action handlers ──────────────────────────────────────

  /**
   * Install a missing skill — sends the capability to the remediate API with
   * user confirmation, then prompts the LLM to re-run the preflight check.
   * Security mandate: user clicked "Install skill" explicitly → confirmed.
   */
  const handleInstallSkill = useCallback(
    async (capability: string, clawhubPackage: string) => {
      const preflightResult = wizard?.preflightResult;
      if (!preflightResult) return;
      try {
        await fetch("/api/personas/preflight/remediate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preflightResult,
            confirmedCapabilities: [capability],
          }),
        });
        // Prompt LLM to recheck — it will output another json:run_preflight block
        void wizard?.sendMessage(
          `I've initiated the installation of the ${clawhubPackage} skill. Please re-run the preflight check to confirm.`,
        );
      } catch {
        // Non-fatal — LLM will handle gracefully
      }
    },
    [wizard],
  );

  /**
   * Enable a disabled skill — safe auto-fix, no confirmation required.
   * Sends to remediate API then asks LLM to recheck.
   */
  const handleEnableSkill = useCallback(
    async (capability: string) => {
      const preflightResult = wizard?.preflightResult;
      if (!preflightResult) return;
      try {
        await fetch("/api/personas/preflight/remediate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            preflightResult,
            confirmedCapabilities: [],
          }),
        });
        void wizard?.sendMessage(
          `I've enabled the skill for ${capability}. Please re-run the preflight check to confirm.`,
        );
      } catch {
        // Non-fatal
      }
    },
    [wizard],
  );

  /** Open the credential vault via parent callback */
  const handleSetupCredential = useCallback(
    (templateKey: string) => {
      onOpenCredentialVault?.(templateKey);
    },
    [onOpenCredentialVault],
  );

  /** Open OAuth URL in a new tab */
  const handleOAuthFlow = useCallback((authUrl: string) => {
    window.open(authUrl, "_blank", "noopener,noreferrer");
  }, []);

  /** Prompt the LLM to re-run the preflight check */
  const handlePrefightRecheck = useCallback(() => {
    if (!wizard?.wizardContext) return;
    const caps = wizard.preflightResult?.capabilities.map((c) => c.capability) ?? [];
    if (caps.length === 0) {
      void wizard.sendMessage(
        "Please re-run the preflight check to verify all capabilities are ready.",
      );
      return;
    }
    void wizard.sendMessage(
      `Please re-run the preflight check for these capabilities: ${caps.join(", ")}.`,
    );
  }, [wizard]);

  const handleComposerSend = useCallback(
    (message: string, attachments?: ChatAttachment[]) => {
      if (isWizardActive) {
        handleWizardSend(message);
        return;
      }
      handleSend(message, attachments);
    },
    [handleSend, handleWizardSend, isWizardActive]
  );

  return (
    <div data-agent-panel className="group fade-up relative flex h-full w-full min-w-0 flex-col overflow-hidden">
      {/* Context warning banner — slim pill at 80%+ utilization */}
      {typeof tokenUsed === "number" && tokenLimit && tokenLimit > 0 && tokenUsed / tokenLimit >= 0.8 && (
        <div className="mx-auto mt-2 flex w-full max-w-3xl items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs sm:px-6">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
          <span className="text-yellow-200">
            Approaching context limit
          </span>
          <span className="ml-auto shrink-0 font-mono text-[10px] text-yellow-200">
            {Math.round((tokenUsed / tokenLimit) * 100)}%
          </span>
        </div>
      )}

      {/* Session continuation banner — slim pill */}
      {sessionContinued && (
        <div className="mx-auto mt-2 flex w-full max-w-3xl items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs sm:px-6">
          <Zap className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
          <span className="text-emerald-200/90">
            Continuing from previous session
          </span>
          {onDismissContinuationBanner && (
            <button
              type="button"
              className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded text-emerald-400/60 transition hover:text-emerald-300"
              aria-label="Dismiss continuation banner"
              onClick={onDismissContinuationBanner}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Session header — autonomy level badge (desktop only, hidden on mobile) */}
      {!viewingSessionKey && (
        <div className="hidden items-center justify-end px-4 pt-1.5 pb-0 sm:flex">
          <AutonomyLevelBadge
            level={(agent.autonomyLevel as AutonomyLevel | undefined) ?? DEFAULT_AUTONOMY_LEVEL}
            onClick={onOpenSettings}
          />
        </div>
      )}

      {/* Chat area — fills remaining space, relative for floating composer */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {viewingSessionKey ? (
          <div className="relative flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
                onClick={onExitSessionView}
              >
                <ArrowLeft className="h-3 w-3" />
                Back to live session
              </button>
              <span className="truncate font-mono text-[10px] text-muted-foreground">
                {viewingSessionKey}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 sm:py-4">
              {viewingSessionLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Loading history…
                  </span>
                </div>
              ) : viewingSessionHistory.length === 0 ? (
                <EmptyStatePanel title="No messages in this session." compact className="p-3 text-xs" />
              ) : (
                <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4 px-5 text-sm text-foreground sm:px-8 md:px-12">
                  <AgentChatView
                    parts={viewingSessionHistory}
                    streaming={false}
                  />
                </div>
              )}
            </div>
          </div>
        ) : isWizardActive && wizard ? (
          /* Wizard mode — show wizard messages inline */
          <div className="h-full overflow-y-auto overflow-x-hidden pb-28 sm:pb-32" style={{ paddingTop: `calc(0.75rem + env(safe-area-inset-top, 0px))` }}>
            <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-5 px-4 text-sm leading-relaxed text-foreground sm:px-8 md:px-12">
              {/* Show existing main chat messages (dimmed) */}
              {agent.messageParts.length > 0 && (
                <div className="pointer-events-none opacity-40 blur-[0.5px] transition-all duration-300">
                  <AgentChatView parts={agent.messageParts} streaming={false} />
                </div>
              )}

              {/* Wizard divider */}
              <div className="my-2 flex items-center gap-2">
                <div className="flex-1 border-t border-border/40" />
                <span className={`text-[10px] font-medium uppercase tracking-wider ${wizard.wizardContext?.theme.accent ?? "text-muted-foreground"}`}>
                  {wizard.wizardContext?.theme.label}
                </span>
                <div className="flex-1 border-t border-border/40" />
              </div>

              {/* Wizard messages */}
              <WizardChatOverlay
                messages={wizard.messages}
                streamText={wizard.streamText}
                thinkingTrace={wizard.thinkingTrace}
                isStreaming={wizard.isStreaming}
                wizardType={wizard.wizardContext!.type}
                extractedConfig={wizard.extractedConfig}
                onConfirmConfig={onWizardConfirm ?? handleWizardExit}
                onReviseConfig={handleWizardRevise}
                onCancelWizard={handleWizardExit}
                confirming={wizardConfirming}
                preflightResult={wizard.preflightResult}
                onInstallSkill={handleInstallSkill}
                onEnableSkill={handleEnableSkill}
                onSetupCredential={handleSetupCredential}
                onOAuthFlow={handleOAuthFlow}
                onRecheck={handlePrefightRecheck}
              />
            </div>
          </div>
        ) : (
          <AgentChatTranscript
            messageParts={agent.messageParts}
            streaming={running}
            scrollToBottomNextOutputRef={scrollToBottomNextOutputRef}
            agentName={agent.name}
            onSendStarter={handleComposerSend}
            sessionKey={agent.sessionKey}
          />
        )}

        {/* Floating composer — absolutely positioned with gradient fade */}
        {!viewingSessionKey && (
          <AgentChatComposer
            inputRef={handleDraftRef}
            initialDraft={agent.draft}
            onDraftChange={handleComposerDraftChange}
            onSend={handleComposerSend}
            onStop={onStopRun}
            onResize={resizeDraft}
            canSend={canSend}
            stopBusy={stopBusy}
            running={running}
            models={models}
            modelValue={
              // ModelPicker expects full "provider/id" format for matching
              agent.model ?? (models.length > 0 ? `${models[0].provider}/${models[0].id}` : "")
            }
            onModelChange={onModelChange}
            thinkingLevel={agent.thinkingLevel ?? "off"}
            onThinkingChange={onThinkingChange}
            tokenUsed={tokenUsed}
            tokenLimit={tokenLimit}
            agentName={agent.name}
            allowThinking={models.length > 0}
            messageParts={agent.messageParts}
            runStartedAt={agent.runStartedAt}
            gatewayStatus={gatewayStatus}
            queueLength={queueLength}
            wizardType={wizard?.wizardContext?.type ?? null}
            wizardTheme={wizard?.wizardContext?.theme ?? null}
            wizardStarters={wizard?.wizardContext?.starters}
            wizardIsStreaming={wizard?.isStreaming}
            wizardHasMessages={(wizard?.messages.length ?? 0) > 0}
            onWizardExit={handleWizardExit}
            onWizardStarterClick={handleWizardStarterClick}
            onNewSession={onNewSession}
            composerAgents={composerAgents}
            selectedAgentId={agent.agentId}
            onSelectAgent={onSelectAgent}
          />
        )}
      </div>
    </div>
  );
});
