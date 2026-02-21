import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MutableRefObject,
} from "react";

import type { AgentState as AgentRecord } from "@/features/agents/state/store";
import type { MessagePart } from "@/lib/chat/types";
import { AlertTriangle, ArrowLeft, ArrowUp, Plus, RefreshCw, Sparkles, Square, X, Zap } from "lucide-react";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { isNearBottom } from "@/lib/dom";
import { AgentChatView } from "./AgentChatView";
import { EmptyStatePanel } from "./EmptyStatePanel";
type AgentChatPanelProps = {
  agent: AgentRecord;
  canSend: boolean;
  models: GatewayModelChoice[];
  stopBusy: boolean;
  onModelChange: (value: string | null) => void;
  onThinkingChange: (value: string | null) => void;
  onDraftChange: (value: string) => void;
  onSend: (message: string) => void;
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

const CHAT_STARTERS = [
  { text: "📋 What's on my agenda?", prompt: "What's on my agenda today?" },
  { text: "🔨 Check project status", prompt: "Check the status of active projects" },
  { text: "📊 Review recent activity", prompt: "Review recent cron and agent activity" },
  { text: "🛠️ Help me build something", prompt: "Help me plan and build a new feature" },
];

const ChatEmptyState = memo(function ChatEmptyState({
  agentName,
  onSend,
}: {
  agentName: string;
  onSend: (message: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-2">
        <Sparkles className="h-7 w-7 text-brand-gold/60" />
        <h2 className="text-lg font-semibold text-foreground">
          What can {agentName} help with?
        </h2>
      </div>
      <div className="grid w-full max-w-md grid-cols-2 gap-2">
        {CHAT_STARTERS.map((s) => (
          <button
            key={s.text}
            type="button"
            onClick={() => onSend(s.prompt)}
            className="rounded-2xl border border-border/50 bg-transparent px-4 py-3.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground min-h-[44px]"
          >
            {s.text}
          </button>
        ))}
      </div>
    </div>
  );
});

const AgentChatTranscript = memo(function AgentChatTranscript({
  messageParts,
  streaming,
  scrollToBottomNextOutputRef,
  agentName,
  onSendStarter,
}: {
  messageParts: MessagePart[];
  streaming: boolean;
  scrollToBottomNextOutputRef: MutableRefObject<boolean>;
  agentName: string;
  onSendStarter: (message: string) => void;
}) {
  const chatRef = useRef<HTMLDivElement | null>(null);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const pinnedRef = useRef(true);
  const userScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialScrollDone = useRef(false);
  const lastScrollHeightRef = useRef(0);
  const [isPinned, setIsPinned] = useState(true);

  /** Smoothly scroll to bottom of chat. Uses native smooth scrolling for fluid feel. */
  const scrollChatToBottom = useCallback((instant?: boolean) => {
    const el = chatRef.current;
    if (!el) return;
    // Skip if user is actively scrolling up
    if (userScrollingRef.current) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: instant ? "instant" : "smooth",
    });
  }, []);

  const setPinned = useCallback((nextPinned: boolean) => {
    if (pinnedRef.current === nextPinned) return;
    pinnedRef.current = nextPinned;
    setIsPinned(nextPinned);
  }, []);

  // Generous threshold: 300px accounts for tool call blocks and rapid streaming
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
        300
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
      // Use instant scroll for initial load — no animation on page load
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollChatToBottom(true);
        });
      });
    }
    if (partCount === 0) {
      initialScrollDone.current = false;
    }
  }, [partCount, scrollChatToBottom]);

  const showJumpToLatest = !isPinned && partCount > 0;

  // Scroll on new message parts
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

  // KEY FIX: ResizeObserver on chat content to auto-scroll during streaming.
  // During streaming, individual text parts grow (content mutates) without the
  // messageParts array length changing, so the partCount effect doesn't fire.
  // This observer detects any content height change and scrolls if pinned.
  useEffect(() => {
    const el = chatRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      const newHeight = el.scrollHeight;
      if (newHeight !== lastScrollHeightRef.current) {
        lastScrollHeightRef.current = newHeight;
        if (pinnedRef.current && !userScrollingRef.current) {
          scheduleScrollToBottom();
        }
      }
    });

    // Observe the first child (the content wrapper) for size changes
    const content = el.firstElementChild;
    if (content) {
      observer.observe(content);
    }

    return () => observer.disconnect();
  }, [scheduleScrollToBottom, partCount]);

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      if (userScrollTimeoutRef.current !== null) {
        clearTimeout(userScrollTimeoutRef.current);
      }
    };
  }, []);

  const hasMessages = partCount > 0;

  return (
    <div className="relative flex-1 overflow-hidden">
      {hasMessages ? (
        <div
          ref={chatRef}
          data-testid="agent-chat-scroll"
          role="log"
          aria-label="Chat messages"
          aria-live="polite"
          className="h-full overflow-y-auto overflow-x-hidden scroll-smooth py-3 pb-36 sm:py-4 sm:pb-40"
          onScroll={() => updatePinnedFromScroll()}
          onWheel={(event) => {
            event.stopPropagation();
            // Detect manual scroll-up: mark user as actively scrolling
            // so auto-scroll doesn't fight their input
            if (event.deltaY < 0) {
              userScrollingRef.current = true;
              if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
              userScrollTimeoutRef.current = setTimeout(() => {
                userScrollingRef.current = false;
              }, 1000);
            }
          }}
          onWheelCapture={(event) => {
            event.stopPropagation();
          }}
          onTouchMove={() => {
            // On mobile, any touch scroll should mark as user-scrolling
            // to prevent auto-scroll fighting the user's finger
            const el = chatRef.current;
            if (!el) return;
            const atBottom = isNearBottom(
              { scrollTop: el.scrollTop, scrollHeight: el.scrollHeight, clientHeight: el.clientHeight },
              300
            );
            if (!atBottom) {
              userScrollingRef.current = true;
              if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
              userScrollTimeoutRef.current = setTimeout(() => {
                userScrollingRef.current = false;
              }, 1500);
            }
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
      ) : (
        <ChatEmptyState agentName={agentName} onSend={onSendStarter} />
      )}

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
  models,
  modelValue,
  onModelChange,
  thinkingLevel,
  onThinkingChange,
  tokenUsed,
  tokenLimit,
  agentName,
  allowThinking,
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
  models: GatewayModelChoice[];
  modelValue: string;
  onModelChange: (value: string | null) => void;
  thinkingLevel: string;
  onThinkingChange: (value: string | null) => void;
  tokenUsed?: number;
  tokenLimit?: number;
  agentName: string;
  allowThinking: boolean;
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

  // Mobile keyboard awareness: adjust composer position when virtual keyboard opens/closes
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      // When keyboard opens, visualViewport.height shrinks.
      // Apply a CSS custom property so the composer stays above the keyboard.
      const offset = window.innerHeight - vv.height;
      document.documentElement.style.setProperty("--keyboard-offset", `${offset}px`);
    };
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    return () => {
      vv.removeEventListener("resize", handler);
      vv.removeEventListener("scroll", handler);
      document.documentElement.style.removeProperty("--keyboard-offset");
    };
  }, []);

  const sendDisabled = !canSend || running || isEmpty;

  const tokenPct = tokenUsed && tokenLimit && tokenLimit > 0
    ? Math.round((tokenUsed / tokenLimit) * 100)
    : null;

  return (
    <div className="absolute inset-x-0 bottom-0 z-10 px-4" style={{ paddingBottom: `calc(12px + env(safe-area-inset-bottom) + var(--keyboard-offset, 0px))` }}>
      {/* Gradient fade above composer */}
      <div className="pointer-events-none h-24 bg-gradient-to-t from-background via-background/80 to-transparent" />
      {/* Model / Thinking selectors above pill */}
      <div className="mx-auto mb-2 flex max-w-3xl items-center gap-2 px-1">
        {models.length > 0 && (
          <select
            className="h-7 rounded-full border border-border/60 bg-muted/50 px-2.5 text-[11px] font-medium text-foreground outline-none transition hover:bg-muted focus:border-border"
            value={modelValue}
            onChange={(e) => onModelChange(e.target.value || null)}
            aria-label="Select model"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name ?? m.id}
              </option>
            ))}
          </select>
        )}
        {allowThinking && (
          <select
            className="h-7 rounded-full border border-border/60 bg-muted/50 px-2.5 text-[11px] font-medium text-foreground outline-none transition hover:bg-muted focus:border-border"
            value={thinkingLevel}
            onChange={(e) => onThinkingChange(e.target.value || null)}
            aria-label="Thinking level"
          >
            <option value="off">Thinking: Off</option>
            <option value="low">Thinking: Low</option>
            <option value="medium">Thinking: Med</option>
            <option value="high">Thinking: High</option>
          </select>
        )}
        {tokenPct !== null && (
          <div className="ml-auto flex items-center gap-1.5 opacity-70">
            <div className="h-1 w-16 overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full rounded-full transition-all ${tokenPct >= 80 ? "bg-yellow-500" : "bg-primary/60"}`}
                style={{ width: `${Math.min(tokenPct, 100)}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">{tokenPct}%</span>
          </div>
        )}
      </div>

      {/* Main composer pill */}
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-border/20 bg-card/80 p-2 shadow-lg backdrop-blur-md focus-within:border-border focus-within:bg-card transition">
        {/* Attach button placeholder */}
        <button
          type="button"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted sm:h-9 sm:w-9"
          aria-label="Attach file"
          disabled
        >
          <Plus className="h-4 w-4" />
        </button>

        <textarea
          ref={handleRef}
          rows={1}
          defaultValue={initialDraft}
          className="max-h-[80px] flex-1 resize-none bg-transparent px-1 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground sm:max-h-[200px]"
          aria-label="Message to agent"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={`Message ${agentName}...`}
        />

        {running ? (
          <button
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:w-8"
            type="button"
            aria-label="Stop agent"
            onClick={onStop}
            disabled={!canSend || stopBusy}
          >
            <Square className="h-3 w-3 fill-current" />
          </button>
        ) : (
          <button
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 sm:h-8 sm:w-8"
            type="button"
            aria-label="Send message"
            onClick={handleClickSend}
            disabled={sendDisabled}
          >
            <ArrowUp className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
});

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
    (message: string) => {
      if (!canSend || agent.status === "running") return;
      const trimmed = message.trim();
      if (!trimmed) return;
      scrollToBottomNextOutputRef.current = true;
      onSend(trimmed);
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
    (message: string) => {
      handleSend(message);
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
            modelValue={agent.model ?? models[0]?.id ?? ""}
            onModelChange={onModelChange}
            thinkingLevel={agent.thinkingLevel ?? "off"}
            onThinkingChange={onThinkingChange}
            tokenUsed={tokenUsed}
            tokenLimit={tokenLimit}
            agentName={agent.name}
            allowThinking={models.length > 0}
          />
        )}
      </div>
    </div>
  );
});
