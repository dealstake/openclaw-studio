import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MutableRefObject,
} from "react";

import { formatTokens } from "@/lib/text/format";
import type { AgentState as AgentRecord } from "@/features/agents/state/store";
import type { MessagePart } from "@/lib/chat/types";
import { AlertTriangle, ArrowLeft, ArrowUp, ChevronDown, ChevronUp, RefreshCw, Settings, Shuffle, SquarePen, X, Zap } from "lucide-react";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { isNearBottom } from "@/lib/dom";
import { AgentAvatar } from "./AgentAvatar";
import { AgentChatView } from "./AgentChatView";
import { EmptyStatePanel } from "./EmptyStatePanel";
import { TokenProgressBar } from "@/components/TokenProgressBar";

type AgentChatPanelProps = {
  agent: AgentRecord;
  isSelected: boolean;
  canSend: boolean;
  models: GatewayModelChoice[];
  stopBusy: boolean;
  onOpenSettings: () => void;
  onModelChange: (value: string | null) => void;
  onThinkingChange: (value: string | null) => void;
  onDraftChange: (value: string) => void;
  onSend: (message: string) => void;
  onStopRun: () => void;
  onAvatarShuffle: () => void;
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

const AgentChatTranscript = memo(function AgentChatTranscript({
  messageParts,
  streaming,
  scrollToBottomNextOutputRef,
}: {
  messageParts: MessagePart[];
  streaming: boolean;
  scrollToBottomNextOutputRef: MutableRefObject<boolean>;
}) {
  const chatRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const pinnedRef = useRef(true);
  const initialScrollDone = useRef(false);
  const [isPinned, setIsPinned] = useState(true);

  const scrollChatToBottom = useCallback(() => {
    if (!chatRef.current) return;
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ block: "end" });
      return;
    }
    chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, []);

  const setPinned = useCallback((nextPinned: boolean) => {
    if (pinnedRef.current === nextPinned) return;
    pinnedRef.current = nextPinned;
    setIsPinned(nextPinned);
  }, []);

  const updatePinnedFromScroll = useCallback(() => {
    const el = chatRef.current;
    if (!el) return;
    setPinned(
      isNearBottom(
        {
          scrollTop: el.scrollTop,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        },
        150
      )
    );
  }, [setPinned]);

  const scheduleScrollToBottom = useCallback(() => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      scrollChatToBottom();
    });
  }, [scrollChatToBottom]);

  useEffect(() => {
    updatePinnedFromScroll();
  }, [updatePinnedFromScroll]);

  // Force scroll to bottom on initial content load and when switching agents
  const partCount = messageParts.length;
  useEffect(() => {
    if (partCount > 0 && !initialScrollDone.current) {
      initialScrollDone.current = true;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollChatToBottom();
        });
      });
    }
    if (partCount === 0) {
      initialScrollDone.current = false;
    }
  }, [partCount, scrollChatToBottom]);

  const showJumpToLatest = !isPinned && partCount > 0;

  useEffect(() => {
    const shouldForceScroll = scrollToBottomNextOutputRef.current;
    if (shouldForceScroll) {
      scrollToBottomNextOutputRef.current = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollChatToBottom();
        });
      });
      return;
    }

    if (pinnedRef.current) {
      scheduleScrollToBottom();
      return;
    }
  }, [
    partCount,
    scheduleScrollToBottom,
    scrollChatToBottom,
    scrollToBottomNextOutputRef,
  ]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={chatRef}
        data-testid="agent-chat-scroll"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        className="h-full overflow-y-auto overflow-x-hidden py-3 sm:py-4"
        onScroll={() => updatePinnedFromScroll()}
        onWheel={(event) => {
          event.stopPropagation();
        }}
        onWheelCapture={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-3 px-4 text-sm text-foreground sm:px-6">
          <AgentChatView
            parts={messageParts}
            streaming={streaming}
          />
          <div ref={chatBottomRef} />
        </div>
      </div>

      {showJumpToLatest ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center">
          <div className="h-12 w-full bg-gradient-to-t from-background via-background/80 to-transparent" />
          <div className="w-full bg-background pb-3">
            <button
              type="button"
              className="pointer-events-auto mx-auto flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition hover:bg-muted/70"
              onClick={() => {
                setPinned(true);
                scrollChatToBottom();
              }}
              aria-label="Jump to latest"
            >
              Jump to latest
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
});

const AgentChatComposer = memo(function AgentChatComposer({
  onDraftChange,
  onSend,
  onStop,
  onResize,
  canSend,
  stopBusy,
  running,
  inputRef,
  initialDraft,
}: {
  onDraftChange: (value: string) => void;
  onSend: (message: string) => void;
  onStop: () => void;
  onResize: () => void;
  canSend: boolean;
  stopBusy: boolean;
  running: boolean;
  inputRef: (el: HTMLTextAreaElement | HTMLInputElement | null) => void;
  initialDraft: string;
}) {
  const localRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingResizeRef = useRef<number | null>(null);
  const [isEmpty, setIsEmpty] = useState(!initialDraft.trim());

  const handleRef = useCallback((el: HTMLTextAreaElement | HTMLInputElement | null) => {
    localRef.current = el instanceof HTMLTextAreaElement ? el : null;
    inputRef(el);
  }, [inputRef]);

  const handleFocus = useCallback(() => {
    const el = localRef.current;
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ block: "nearest" });
      });
    }
  }, []);

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      setIsEmpty(!value.trim());
      onDraftChange(value);
      if (pendingResizeRef.current !== null) {
        cancelAnimationFrame(pendingResizeRef.current);
      }
      pendingResizeRef.current = requestAnimationFrame(() => {
        pendingResizeRef.current = null;
        onResize();
      });
    },
    [onDraftChange, onResize]
  );

  const clearAfterSend = useCallback(() => {
    const el = localRef.current;
    if (el) {
      el.value = "";
      el.style.height = "auto";
    }
    setIsEmpty(true);
    onDraftChange("");
  }, [onDraftChange]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      if (event.defaultPrevented) return;
      event.preventDefault();
      const value = localRef.current?.value ?? "";
      const trimmed = value.trim();
      if (trimmed) {
        onSend(trimmed);
        clearAfterSend();
      }
    },
    [onSend, clearAfterSend]
  );

  const handleClickSend = useCallback(() => {
    const value = localRef.current?.value ?? "";
    const trimmed = value.trim();
    if (trimmed) {
      onSend(trimmed);
      clearAfterSend();
    }
  }, [onSend, clearAfterSend]);

  // Cleanup rAF on unmount
  useEffect(() => {
    return () => {
      if (pendingResizeRef.current !== null) {
        cancelAnimationFrame(pendingResizeRef.current);
      }
    };
  }, []);

  const sendDisabled = !canSend || running || isEmpty;

  return (
    <div className="shrink-0 border-t border-border/50 px-4 py-3 sm:px-6 sm:py-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border bg-card p-2 shadow-sm sm:p-3">
        <textarea
          ref={handleRef}
          rows={1}
          defaultValue={initialDraft}
          className="max-h-[80px] flex-1 resize-none bg-transparent px-2 py-1 text-base text-foreground outline-none placeholder:text-muted-foreground/50 transition sm:max-h-[200px] sm:text-sm"
          aria-label="Message to agent"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder="Type a message..."
        />
        {running ? (
          <button
            className="flex h-9 min-w-[36px] items-center justify-center rounded-lg border border-destructive/40 bg-destructive/10 text-destructive shadow-sm transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none sm:h-10 sm:min-w-[40px] sm:px-3"
            type="button"
            aria-label="Stop agent"
            onClick={onStop}
            disabled={!canSend || stopBusy}
          >
            <span className="sr-only">Stop</span>
            <div className="h-3 w-3 rounded-[2px] bg-destructive" />
          </button>
        ) : null}
        <button
          className="flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9"
          type="button"
          aria-label="Send message"
          onClick={handleClickSend}
          disabled={sendDisabled}
        >
          <ArrowUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
});

export const AgentChatPanel = memo(function AgentChatPanel({
  agent,
  isSelected,
  canSend,
  models,
  stopBusy,
  onOpenSettings,
  onModelChange,
  onThinkingChange,
  onDraftChange,
  onSend,
  onStopRun,
  onAvatarShuffle,
  tokenUsed,
  tokenLimit,
  onNewSession,
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
  const [mobileHeaderExpanded, setMobileHeaderExpanded] = useState(false);

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

  const toggleMobileHeader = useCallback(() => {
    setMobileHeaderExpanded((prev) => !prev);
  }, []);

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
    (message: string) => {
      if (!canSend || agent.status === "running") return;
      const trimmed = message.trim();
      if (!trimmed) return;
      scrollToBottomNextOutputRef.current = true;
      onSend(trimmed);
    },
    [agent.status, canSend, onSend]
  );

  const statusColor =
    agent.status === "running"
      ? "border border-primary/30 bg-primary/15 text-foreground"
      : agent.status === "error"
        ? "border border-destructive/35 bg-destructive/12 text-destructive"
        : "border border-border/70 bg-muted text-muted-foreground";
  const statusLabel =
    agent.status === "running"
      ? "Running"
      : agent.status === "error"
        ? "Error"
        : "Idle";

  const modelOptions = useMemo(
    () =>
      models.map((entry) => ({
        value: `${entry.provider}/${entry.id}`,
        label:
          entry.name === `${entry.provider}/${entry.id}`
            ? entry.name
            : `${entry.name} (${entry.provider}/${entry.id})`,
        reasoning: entry.reasoning,
      })),
    [models]
  );
  const modelValue = agent.model ?? "";
  const modelOptionsWithFallback =
    modelValue && !modelOptions.some((option) => option.value === modelValue)
      ? [{ value: modelValue, label: modelValue, reasoning: undefined }, ...modelOptions]
      : modelOptions;
  const selectedModel = modelOptionsWithFallback.find((option) => option.value === modelValue);
  const allowThinking = selectedModel?.reasoning !== false;

  const avatarSeed = agent.avatarSeed ?? agent.agentId;
  const running = agent.status === "running";

  const handleComposerDraftChange = useCallback(
    (value: string) => {
      plainDraftRef.current = value;
      onDraftChange(value);
    },
    [onDraftChange]
  );

  const handleComposerSend = useCallback(
    (message: string) => {
      handleSend(message);
    },
    [handleSend]
  );

  return (
    <div data-agent-panel className="group fade-up relative flex h-full w-full min-w-0 flex-col overflow-hidden">
      {/* Slim toolbar — agent name + controls + model/thinking inline */}
      <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-2 sm:px-4">
        <div className="group/avatar relative shrink-0">
          <AgentAvatar
            seed={avatarSeed}
            name={agent.name}
            avatarUrl={agent.avatarUrl ?? null}
            size={32}
            isSelected={isSelected}
          />
          <button
            className="nodrag pointer-events-none absolute -bottom-0.5 -right-0.5 hidden h-5 w-5 items-center justify-center rounded-full border border-border/80 bg-card/90 text-muted-foreground opacity-0 shadow-sm transition group-focus-within/avatar:pointer-events-auto group-focus-within/avatar:opacity-100 group-hover/avatar:pointer-events-auto group-hover/avatar:opacity-100 hover:border-border hover:bg-muted/65 sm:flex"
            type="button"
            aria-label="Shuffle avatar"
            data-testid="agent-avatar-shuffle"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onAvatarShuffle();
            }}
          >
            <Shuffle className="h-2.5 w-2.5" />
          </button>
        </div>

        <span className="min-w-0 truncate text-sm font-semibold text-foreground">
          {agent.name}
        </span>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] ${statusColor}`}
        >
          {statusLabel}
        </span>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Model selector — inline compact */}
        <select
          className="hidden h-7 max-w-[180px] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-border bg-card/75 px-2 text-[11px] font-medium text-muted-foreground transition hover:text-foreground sm:block"
          aria-label="Model"
          title={modelValue}
          value={modelValue}
          onChange={(event) => {
            const value = event.target.value.trim();
            onModelChange(value ? value : null);
          }}
        >
          {modelOptionsWithFallback.length === 0 ? (
            <option value="">No models</option>
          ) : null}
          {modelOptionsWithFallback.map((option) => (
            <option key={option.value} value={option.value} title={option.value}>
              {option.label.split(" (")[0]}
            </option>
          ))}
        </select>

        {/* Thinking selector — inline compact */}
        {allowThinking ? (
          <select
            className="hidden h-7 w-[90px] rounded-md border border-border bg-card/75 px-2 text-[11px] font-medium text-muted-foreground transition hover:text-foreground sm:block"
            aria-label="Thinking"
            value={agent.thinkingLevel ?? ""}
            onChange={(event) => {
              const value = event.target.value.trim();
              onThinkingChange(value ? value : null);
            }}
          >
            <option value="">Thinking</option>
            <option value="off">Off</option>
            <option value="minimal">Minimal</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="xhigh">XHigh</option>
          </select>
        ) : null}

        {/* Token usage — slim inline */}
        {typeof tokenUsed === "number" && tokenLimit ? (
          <div className="hidden items-center gap-1.5 sm:flex">
            <div className="w-16">
              <TokenProgressBar used={tokenUsed} limit={tokenLimit} />
            </div>
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
              {formatTokens(tokenUsed)}
            </span>
          </div>
        ) : null}

        {/* Action buttons */}
        {onNewSession ? (
          <button
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            data-testid="agent-new-session"
            aria-label="New session"
            title="New session"
            onClick={onNewSession}
            disabled={running}
          >
            <SquarePen className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <button
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground"
          type="button"
          data-testid="agent-settings-toggle"
          aria-label="Open agent settings"
          title="Agent settings"
          onClick={onOpenSettings}
        >
          <Settings className="h-3.5 w-3.5" />
        </button>

        {/* Mobile: expand model settings */}
        <button
          type="button"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground sm:hidden"
          onClick={toggleMobileHeader}
          aria-expanded={mobileHeaderExpanded}
          aria-controls="mobile-model-settings"
          aria-label={mobileHeaderExpanded ? "Collapse model settings" : "Expand model settings"}
        >
          {mobileHeaderExpanded ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Mobile model settings (expandable) */}
      {mobileHeaderExpanded && (
        <div id="mobile-model-settings" className="border-b border-border/50 px-3 py-2 sm:hidden">
          <div className="flex gap-2">
            <select
              className="h-7 min-w-0 flex-1 rounded-md border border-border bg-card/75 px-2 text-[11px] font-medium text-foreground"
              aria-label="Model"
              value={modelValue}
              onChange={(event) => {
                const value = event.target.value.trim();
                onModelChange(value ? value : null);
              }}
            >
              {modelOptionsWithFallback.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label.split(" (")[0]}
                </option>
              ))}
            </select>
            {allowThinking ? (
              <select
                className="h-7 w-[90px] rounded-md border border-border bg-card/75 px-2 text-[11px] font-medium text-foreground"
                aria-label="Thinking"
                value={agent.thinkingLevel ?? ""}
                onChange={(event) => {
                  const value = event.target.value.trim();
                  onThinkingChange(value ? value : null);
                }}
              >
                <option value="">Thinking</option>
                <option value="off">Off</option>
                <option value="minimal">Minimal</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="xhigh">XHigh</option>
              </select>
            ) : null}
          </div>
          {typeof tokenUsed === "number" && tokenLimit ? (
            <div className="mt-2 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <TokenProgressBar used={tokenUsed} limit={tokenLimit} />
              </div>
              <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                {formatTokens(tokenUsed)}/{formatTokens(tokenLimit)}
              </span>
            </div>
          ) : null}
        </div>
      )}

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

      {/* Chat area — fills remaining space */}
      <div className="flex min-h-0 flex-1 flex-col">
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
              <span className="truncate font-mono text-[9px] text-muted-foreground">
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
                <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-3 px-4 text-sm text-foreground sm:px-6">
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
          />
        )}

        {/* Composer — natural flow, not absolute positioned */}
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
          />
        )}
      </div>
    </div>
  );
});
