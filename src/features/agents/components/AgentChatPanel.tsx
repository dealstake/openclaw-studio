import {
  memo,
  useCallback,
  useEffect,
  useRef,
} from "react";

import type { AgentState as AgentRecord } from "@/features/agents/state/store";
import type { MessagePart } from "@/lib/chat/types";
import { AlertTriangle, ArrowLeft, RefreshCw, X, Zap } from "lucide-react";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import type { ChatAttachment } from "../hooks/useFileUpload";
import { AgentChatView } from "./AgentChatView";
import { EmptyStatePanel } from "./EmptyStatePanel";
import { AgentChatTranscript } from "./AgentChatTranscript";
import { AgentChatComposer } from "./AgentChatComposer";

type AgentChatPanelProps = {
  agent: AgentRecord;
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
};

export const AgentChatPanel = memo(function AgentChatPanel({
  agent,
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

  const handleComposerSend = useCallback(
    (message: string, attachments?: ChatAttachment[]) => {
      handleSend(message, attachments);
    },
    [handleSend]
  );

  return (
    <div data-agent-panel className="group fade-up relative flex h-full w-full min-w-0 flex-col overflow-hidden">
      {/* Context warning banner — slim pill at 80%+ utilization */}
      {typeof tokenUsed === "number" && tokenLimit && tokenLimit > 0 && tokenUsed / tokenLimit >= 0.8 && (
        <div className="mx-auto mt-2 flex w-full max-w-3xl items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-1.5 text-xs sm:px-6">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-yellow-500" />
          <span className="text-yellow-200/90">
            Approaching context limit
          </span>
          <span className="ml-auto shrink-0 font-mono text-[10px] text-yellow-500/80">
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
                <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-4 px-4 text-sm text-foreground sm:px-8 md:px-12">
                  <AgentChatView
                    parts={viewingSessionHistory}
                    streaming={false}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          <AgentChatTranscript
            messageParts={agent.messageParts}
            streaming={running}
            scrollToBottomNextOutputRef={scrollToBottomNextOutputRef}
            agentName={agent.name}
            onSendStarter={handleComposerSend}
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
              // agent.model may include provider prefix (e.g. "anthropic/claude-opus-4-6")
              // but select option values are just the model id (e.g. "claude-opus-4-6").
              // Strip the provider prefix so the select matches correctly.
              (() => {
                const raw = agent.model ?? "";
                const stripped = raw.includes("/") ? raw.split("/").slice(1).join("/") : raw;
                // If the stripped value matches a known model id, use it; otherwise fall back to first model
                const match = models.find((m) => m.id === stripped);
                return match ? match.id : models[0]?.id ?? "";
              })()
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
          />
        )}
      </div>
    </div>
  );
});
