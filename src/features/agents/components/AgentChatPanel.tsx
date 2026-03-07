import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { AgentState as AgentRecord } from "@/features/agents/state/store";
import type { MessagePart } from "@/lib/chat/types";
import { extractLastAssistantText } from "@/features/agents/lib/extractLastAssistantText";
import { AlertTriangle, ArrowLeft, Bot, Info, RefreshCw, X, Zap } from "lucide-react";
import {
  CalendarClock,
  FolderKanban,
  KeyRound,
  Puzzle,
  UserCog,
} from "lucide-react";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { ChatAttachment } from "../hooks/useFileUpload";
import { AgentChatView } from "./AgentChatView";
import { EmptyStatePanel } from "./EmptyStatePanel";
import { AgentChatTranscript } from "./AgentChatTranscript";
import { AgentChatComposer } from "./AgentChatComposer";
import type { UseWizardInChatReturn } from "@/features/wizards/hooks/useWizardInChat";
import { WizardChatOverlay } from "@/features/wizards/components/WizardChatOverlay";
import type { WizardType } from "@/features/wizards/lib/wizardTypes";
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
  viewingSessionError?: string | null;
  onRetryTranscript?: () => void;
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
  /** Called when user selects a wizard type from the manual launch menu */
  onLaunchWizard?: (type: WizardType) => void;
  /** Creation result — shown after wizard creation completes */
  wizardCreationResult?: { success: boolean; message: string; resourceName?: string } | null;
  /** Step-by-step creation progress */
  wizardCreationSteps?: Array<{ label: string; status: "pending" | "active" | "done" | "error" }> | null;
  /** Called to dismiss the creation result card */
  onDismissWizardResult?: () => void;
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
  viewingSessionError = null,
  onRetryTranscript,
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
  onLaunchWizard,
  wizardCreationResult = null,
  wizardCreationSteps = null,
  onDismissWizardResult,
}: AgentChatPanelProps) {
  const [contextBannerDismissed, setContextBannerDismissed] = useState(false);
  const [wizardInfoOpen, setWizardInfoOpen] = useState(false);

  // Icon map for wizard types — used in mobile header transition
  const WIZARD_HEADER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    CalendarClock,
    Bot,
    FolderKanban,
    Puzzle,
    KeyRound,
    UserCog,
  };
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
    const maxH = Math.min(el.scrollHeight, 200);
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

  // Extract last assistant text from message parts for TTS.
  const lastAssistantText = useMemo(
    () => extractLastAssistantText(agent.messageParts ?? []),
    [agent.messageParts],
  );

  return (
    <div data-agent-panel className="group fade-up relative flex h-full w-full min-w-0 flex-col overflow-hidden bg-surface-sunken">
      {/* Context warning banner — slim pill at 80%+ utilization */}
      {typeof tokenUsed === "number" && tokenLimit && tokenLimit > 0 && tokenUsed / tokenLimit >= 0.8 && !contextBannerDismissed && (
        <div className="mx-auto mt-2 flex w-full max-w-3xl 2xl:max-w-4xl items-center gap-2 rounded-lg border border-border/60 bg-muted/60 px-3 py-1.5 text-xs sm:px-6">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-foreground/80">
            Approaching context limit
          </span>
          <span className="shrink-0 font-sans text-[10px] text-muted-foreground">
            {Math.round((tokenUsed / tokenLimit) * 100)}%
          </span>
          <button
            type="button"
            className="ml-auto flex h-8 w-8 -mr-1 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition hover:text-foreground/80"
            aria-label="Dismiss context limit banner"
            onClick={() => setContextBannerDismissed(true)}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Session continuation banner — slim pill */}
      {sessionContinued && (
        <div className="mx-auto mt-2 flex w-full max-w-3xl 2xl:max-w-4xl items-center gap-2 rounded-lg border border-border/60 bg-muted/60 px-3 py-1.5 text-xs sm:px-6">
          <Zap className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-foreground/80">
            Continuing from previous session
          </span>
          {onDismissContinuationBanner && (
            <button
              type="button"
              className="ml-auto flex h-8 w-8 -mr-1 shrink-0 items-center justify-center rounded text-muted-foreground/60 transition hover:text-foreground/80"
              aria-label="Dismiss continuation banner"
              onClick={onDismissContinuationBanner}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      {/* Mobile chat header — agent name, transitions to wizard theme when active */}
      {!viewingSessionKey && (
        <div className="flex items-center justify-between px-4 pt-2 pb-1 sm:hidden">
          {isWizardActive && wizard?.wizardContext?.theme ? (() => {
            const theme = wizard.wizardContext.theme;
            const WizIcon = WIZARD_HEADER_ICONS[theme.icon];
            return (
              <div className="flex items-center gap-2 min-w-0">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full ${theme.bg}`}>
                  {WizIcon ? <WizIcon className={`h-3.5 w-3.5 ${theme.accent}`} /> : <Bot className={`h-3.5 w-3.5 ${theme.accent}`} />}
                </div>
                <span className={`text-sm font-semibold truncate ${theme.accent}`}>{theme.label}</span>
                <button
                  type="button"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  aria-label={`About ${theme.label}`}
                  onClick={() => setWizardInfoOpen(v => !v)}
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })() : (
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground">{agent.name || agent.agentId}</span>
            </div>
          )}
          {/* Exit button when wizard is active */}
          {isWizardActive && onWizardConfirm && (
            <button
              type="button"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Exit wizard"
              onClick={() => wizard?.endWizard()}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Mobile wizard info tooltip — appears below header when ⓘ tapped */}
      {wizardInfoOpen && isWizardActive && wizard?.wizardContext?.theme && (
        <div className="mx-4 mb-1 rounded-lg border border-border/50 bg-card px-3 py-2 text-xs text-muted-foreground sm:hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <p>
            {wizard.wizardContext.type === "persona" && "Describe the persona you want to create — role, tone, expertise. The builder will guide you through the process."}
            {wizard.wizardContext.type === "task" && "Describe the task you want to automate — what it does, how often, and any conditions."}
            {wizard.wizardContext.type === "project" && "Describe your project — goals, scope, and timeline. The wizard will help you plan it out."}
            {wizard.wizardContext.type === "skill" && "Describe the skill you want to build — what tool or API it wraps, and how the agent should use it."}
            {wizard.wizardContext.type === "agent" && "Describe the agent you want to create — its purpose, personality, and capabilities."}
            {wizard.wizardContext.type === "credential" && "Add an API key or service credential. The wizard will securely store it in your vault."}
          </p>
          <button
            type="button"
            className="mt-1 text-[10px] text-primary hover:underline"
            onClick={() => setWizardInfoOpen(false)}
          >
            Dismiss
          </button>
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
              <span className="truncate font-sans text-[10px] text-muted-foreground">
                {viewingSessionKey}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 sm:py-4">
              {viewingSessionLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 font-sans text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    Loading history…
                  </span>
                </div>
              ) : viewingSessionError ? (
                <div role="alert" className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <AlertTriangle className="h-5 w-5 text-destructive/70" />
                  <p className="font-sans text-xs text-muted-foreground">
                    Unable to load this session&apos;s transcript.
                  </p>
                  <p className="max-w-xs font-sans text-xs text-muted-foreground/60">
                    {viewingSessionError}
                  </p>
                  {onRetryTranscript && (
                    <button
                      type="button"
                      onClick={onRetryTranscript}
                      className="mt-4 flex h-10 min-h-[44px] items-center gap-2 rounded-lg border border-border/50 px-4 py-2 font-sans text-sm font-medium text-foreground transition hover:bg-muted/50"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Retry
                    </button>
                  )}
                </div>
              ) : viewingSessionHistory.length === 0 ? (
                <EmptyStatePanel title="No messages in this session." compact className="p-3 text-xs" />
              ) : (
                <div className="mx-auto flex w-full min-w-0 max-w-3xl 2xl:max-w-4xl flex-col gap-4 px-5 text-sm text-foreground sm:px-8 md:px-12">
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
          <div className="h-full overflow-y-auto overflow-x-hidden pt-3 pb-28 sm:pt-4 sm:pb-32">
            <div className="mx-auto flex w-full min-w-0 max-w-3xl 2xl:max-w-4xl flex-col gap-5 px-5 text-sm leading-relaxed text-foreground sm:px-8 md:px-12">
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
                creationSteps={wizardCreationSteps}
                creationResult={wizardCreationResult}
                onDismissResult={onDismissWizardResult}
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
            lastAssistantText={lastAssistantText}
            onLaunchWizard={onLaunchWizard}
          />
        )}
      </div>
    </div>
  );
});
