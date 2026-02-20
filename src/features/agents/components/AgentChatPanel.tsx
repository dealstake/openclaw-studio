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

import { sectionLabelClass } from "@/components/SectionLabel";

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
    <div className="relative flex-1 overflow-hidden rounded-md border border-border/80 bg-card/75">
      <div
        ref={chatRef}
        data-testid="agent-chat-scroll"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        className="h-full overflow-y-auto overflow-x-hidden p-3 pb-24 sm:p-4 sm:pb-24"
        onScroll={() => updatePinnedFromScroll()}
        onWheel={(event) => {
          event.stopPropagation();
        }}
        onWheelCapture={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex w-full min-w-0 flex-col gap-3 px-4 text-xs text-foreground sm:px-8 lg:px-16">
          <AgentChatView
            parts={messageParts}
            streaming={streaming}
          />
          <div ref={chatBottomRef} />
        </div>
      </div>

      {showJumpToLatest ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center">
          <div className="h-12 w-full bg-gradient-to-t from-card via-card/80 to-transparent" />
          <div className="w-full bg-card pb-3">
            <button
              type="button"
              className={`pointer-events-auto mx-auto flex max-w-[calc(100%-2rem)] rounded-md border border-border/80 bg-card/95 px-3 py-1.5 ${sectionLabelClass} text-foreground shadow-sm transition hover:bg-muted/70`}
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
    <div className="fixed inset-x-0 bottom-0 z-20 px-3 pb-3 backdrop-blur-md sm:absolute sm:inset-x-0 sm:bottom-0 sm:z-20 sm:px-4 sm:pb-6 sm:pt-4">
      <div className="mx-1 flex items-end gap-2 rounded-xl border border-border/80 bg-card/90 p-2 shadow-lg sm:mx-4 sm:rounded-2xl sm:border-border sm:bg-card sm:p-3 sm:shadow-xl lg:mx-12">
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
      <div className="px-3 pt-3 sm:px-4 sm:pt-4">
        <div className="flex items-start gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="group/avatar relative">
              <div className="hidden sm:block">
                <AgentAvatar
                  seed={avatarSeed}
                  name={agent.name}
                  avatarUrl={agent.avatarUrl ?? null}
                  size={56}
                  isSelected={isSelected}
                />
              </div>
              <div className="sm:hidden">
                <AgentAvatar
                  seed={avatarSeed}
                  name={agent.name}
                  avatarUrl={agent.avatarUrl ?? null}
                  size={48}
                  isSelected={isSelected}
                />
              </div>
              <button
                className="nodrag pointer-events-none absolute bottom-1 right-1 hidden h-7 w-7 items-center justify-center rounded-full border border-border/80 bg-card/90 text-muted-foreground opacity-0 shadow-sm transition group-focus-within/avatar:pointer-events-auto group-focus-within/avatar:opacity-100 group-hover/avatar:pointer-events-auto group-hover/avatar:opacity-100 hover:border-border hover:bg-muted/65 sm:flex"
                type="button"
                aria-label="Shuffle avatar"
                data-testid="agent-avatar-shuffle"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onAvatarShuffle();
                }}
              >
                <Shuffle className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.16em] text-foreground sm:text-sm">
                  {agent.name}
                </div>
                {onNewSession ? (
                  <button
                    className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-input/90 bg-background/75 text-foreground shadow-sm transition hover:border-ring hover:bg-card disabled:cursor-not-allowed disabled:opacity-60"
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
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-input/90 bg-background/75 text-foreground shadow-sm transition hover:border-ring hover:bg-card"
                  type="button"
                  data-testid="agent-settings-toggle"
                  aria-label="Open agent settings"
                  title="Agent settings"
                  onClick={onOpenSettings}
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
                <span aria-hidden className="shrink-0 text-[11px] text-muted-foreground/80">
                  •
                </span>
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.14em] ${statusColor}`}
                >
                  {statusLabel}
                </span>
              </div>

              {/* Mobile: toggle button for model/thinking/token */}
              <button
                type="button"
                className="mt-1.5 flex items-center gap-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:text-foreground sm:hidden"
                onClick={toggleMobileHeader}
                aria-expanded={mobileHeaderExpanded}
                aria-controls="mobile-model-settings"
                aria-label={mobileHeaderExpanded ? "Collapse model settings" : "Expand model settings"}
              >
                {mobileHeaderExpanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
                <span>{selectedModel ? selectedModel.label.split(" (")[0] : "Settings"}</span>
                {typeof tokenUsed === "number" && tokenLimit ? (
                  <span className="ml-1 text-muted-foreground/60">
                    · {Math.round((tokenUsed / tokenLimit) * 100)}%
                  </span>
                ) : null}
              </button>

              {/* Desktop: always visible; Mobile: only when expanded */}
              <div id="mobile-model-settings" className={`${mobileHeaderExpanded ? "block" : "hidden"} sm:block`}>
                <div className="mt-2 grid max-w-md gap-2 sm:grid-cols-[minmax(0,1fr)_128px]">
                  <label className="flex min-w-0 flex-col gap-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    <span>Model</span>
                    <select
                      className="h-8 w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-border bg-card/75 px-2 text-[11px] font-semibold text-foreground"
                      aria-label="Model"
                      title={modelValue}
                      value={modelValue}
                      onChange={(event) => {
                        const value = event.target.value.trim();
                        onModelChange(value ? value : null);
                      }}
                    >
                      {modelOptionsWithFallback.length === 0 ? (
                        <option value="">No models found</option>
                      ) : null}
                      {modelOptionsWithFallback.map((option) => (
                        <option key={option.value} value={option.value} title={option.value}>
                          {option.label.split(" (")[0]}
                        </option>
                      ))}
                    </select>
                  </label>
                  {allowThinking ? (
                    <label className="flex flex-col gap-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      <span>Thinking</span>
                      <select
                        className="h-8 rounded-md border border-border bg-card/75 px-2 text-[11px] font-semibold text-foreground"
                        aria-label="Thinking"
                        value={agent.thinkingLevel ?? ""}
                        onChange={(event) => {
                          const value = event.target.value.trim();
                          onThinkingChange(value ? value : null);
                        }}
                      >
                        <option value="">Default</option>
                        <option value="off">Off</option>
                        <option value="minimal">Minimal</option>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="xhigh">XHigh</option>
                      </select>
                    </label>
                  ) : (
                    <div />
                  )}
                </div>
                {typeof tokenUsed === "number" && tokenLimit ? (
                  <div className="mt-2 flex w-full max-w-lg items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <TokenProgressBar used={tokenUsed} limit={tokenLimit} />
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
                      {formatTokens(tokenUsed)}/{formatTokens(tokenLimit)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Context warning banner — yellow at 80%+ utilization */}
      {typeof tokenUsed === "number" && tokenLimit && tokenLimit > 0 && tokenUsed / tokenLimit >= 0.8 && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 sm:mx-4">
          <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500" />
          <span className="text-xs text-yellow-200/90">
            Session approaching context limit — work will continue in a new session
          </span>
          <span className="ml-auto shrink-0 font-mono text-[10px] text-yellow-500/80">
            {Math.round((tokenUsed / tokenLimit) * 100)}%
          </span>
        </div>
      )}

      {/* Session continuation banner — green after session reset */}
      {sessionContinued && (
        <div className="mx-3 mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 sm:mx-4">
          <Zap className="h-4 w-4 shrink-0 text-emerald-500" />
          <span className="text-xs text-emerald-200/90">
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

      <div className={`mt-3 flex min-h-0 flex-1 flex-col gap-3 px-3 sm:px-4 ${viewingSessionKey ? "pb-3 sm:pb-4" : "pb-24 sm:pb-24"}`}>
        {viewingSessionKey ? (
          <div className="relative flex flex-1 flex-col overflow-hidden rounded-md border border-border/80 bg-card/75">
            <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
              <button
                type="button"
                className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${sectionLabelClass} text-muted-foreground transition hover:bg-muted/50 hover:text-foreground`}
                onClick={onExitSessionView}
              >
                <ArrowLeft className="h-3 w-3" />
                Back to live session
              </button>
              <span className="truncate font-mono text-[9px] text-muted-foreground">
                {viewingSessionKey}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4">
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
                <div className="flex w-full min-w-0 flex-col gap-3 px-4 text-xs text-foreground sm:px-8 lg:px-16">
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
