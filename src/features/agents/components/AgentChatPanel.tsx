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

function useRecentlyCompacted(lastCompactedAt: number | null | undefined): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!lastCompactedAt) return;
    const elapsed = Date.now() - lastCompactedAt;
    if (elapsed >= 60000) return;
    // Use a microtask to avoid synchronous setState in effect
    void Promise.resolve().then(() => setVisible(true));
    const timer = window.setTimeout(() => setVisible(false), 60000 - elapsed);
    return () => window.clearTimeout(timer);
  }, [lastCompactedAt]);

  return visible;
}
import type { AgentState as AgentRecord } from "@/features/agents/state/store";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Archive, ArrowLeft, ChevronRight, RefreshCw, Settings, Shuffle, SquarePen } from "lucide-react";
import type { GatewayModelChoice } from "@/lib/gateway/models";
import { isToolMarkdown, isTraceMarkdown } from "@/lib/text/message-extract";
import { isNearBottom } from "@/lib/dom";
import { AgentAvatar } from "./AgentAvatar";
import {
  buildFinalAgentChatItems,
  normalizeAssistantDisplayText,
  summarizeToolLabel,
  type AgentChatItem,
} from "./chatItems";
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
  onCompact?: () => void;
  isCompacting?: boolean;
  lastCompactedAt?: number | null;
  viewingSessionKey?: string | null;
  viewingSessionHistory?: string[];
  viewingSessionLoading?: boolean;
  onExitSessionView?: () => void;
};

const AgentChatFinalItems = memo(function AgentChatFinalItems({
  agentId,
  name,
  avatarSeed,
  avatarUrl,
  chatItems,
  autoExpandThinking,
  lastThinkingItemIndex,
}: {
  agentId: string;
  name: string;
  avatarSeed: string;
  avatarUrl: string | null;
  chatItems: AgentChatItem[];
  autoExpandThinking: boolean;
  lastThinkingItemIndex: number;
}) {
  return (
    <>
      {chatItems.map((item, index) => {
        if (item.kind === "thinking") {
          return (
            <details
              key={`chat-${agentId}-thinking-${index}`}
              className="rounded-md border border-border/70 bg-muted/55 text-[11px] text-muted-foreground"
              open={autoExpandThinking && index === lastThinkingItemIndex}
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.11em] [&::-webkit-details-marker]:hidden">
                <AgentAvatar seed={avatarSeed} name={name} avatarUrl={avatarUrl} size={22} />
                <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200 [[open]>&]:rotate-90" />
                <span>Thinking</span>
              </summary>
              <div className="agent-markdown px-2 pb-2 text-foreground">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.text}</ReactMarkdown>
              </div>
            </details>
          );
        }
        if (item.kind === "user") {
          return (
            <div
              key={`chat-${agentId}-user-${index}`}
              className="rounded-md border border-border/70 bg-muted/70 px-3 py-2 text-foreground"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{`> ${item.text}`}</ReactMarkdown>
            </div>
          );
        }
        if (item.kind === "tool") {
          const { summaryText, body } = summarizeToolLabel(item.text);
          return (
            <details
              key={`chat-${agentId}-tool-${index}`}
              className="rounded-md border border-border/70 bg-muted/55 px-2 py-1 text-[11px] text-muted-foreground"
            >
              <summary className="cursor-pointer select-none font-mono text-[10px] font-semibold uppercase tracking-[0.11em]">
                {summaryText}
              </summary>
              {body ? (
                <div className="agent-markdown mt-1 text-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
                </div>
              ) : null}
            </details>
          );
        }
        return (
          <div
            key={`chat-${agentId}-assistant-${index}`}
            className="agent-markdown min-w-0 overflow-hidden rounded-md border border-transparent px-0.5"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.text}</ReactMarkdown>
          </div>
        );
      })}
    </>
  );
});

const AgentChatTranscript = memo(function AgentChatTranscript({
  agentId,
  name,
  avatarSeed,
  avatarUrl,
  status,
  chatItems,
  autoExpandThinking,
  lastThinkingItemIndex,
  liveThinkingText,
  liveAssistantText,
  showTypingIndicator,
  outputLineCount,
  liveAssistantCharCount,
  liveThinkingCharCount,
  scrollToBottomNextOutputRef,
}: {
  agentId: string;
  name: string;
  avatarSeed: string;
  avatarUrl: string | null;
  status: AgentRecord["status"];
  chatItems: AgentChatItem[];
  autoExpandThinking: boolean;
  lastThinkingItemIndex: number;
  liveThinkingText: string;
  liveAssistantText: string;
  showTypingIndicator: boolean;
  outputLineCount: number;
  liveAssistantCharCount: number;
  liveThinkingCharCount: number;
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
  useEffect(() => {
    if (outputLineCount > 0 && !initialScrollDone.current) {
      initialScrollDone.current = true;
      // Use double rAF to ensure DOM has fully rendered content
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollChatToBottom();
        });
      });
    }
    if (outputLineCount === 0) {
      initialScrollDone.current = false;
    }
  }, [outputLineCount, scrollChatToBottom]);

  const showJumpToLatest =
    !isPinned && (outputLineCount > 0 || liveAssistantCharCount > 0 || liveThinkingCharCount > 0);

  useEffect(() => {
    const shouldForceScroll = scrollToBottomNextOutputRef.current;
    if (shouldForceScroll) {
      scrollToBottomNextOutputRef.current = false;
      scheduleScrollToBottom();
      return;
    }

    if (pinnedRef.current) {
      scheduleScrollToBottom();
      return;
    }
  }, [
    liveAssistantCharCount,
    liveThinkingCharCount,
    outputLineCount,
    scheduleScrollToBottom,
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
        className="h-full overflow-y-auto overflow-x-hidden p-3 sm:p-4"
        onScroll={() => updatePinnedFromScroll()}
        onWheel={(event) => {
          event.stopPropagation();
        }}
        onWheelCapture={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex min-w-0 flex-col gap-3 text-xs text-foreground">
          {chatItems.length === 0 ? (
            <EmptyStatePanel title="No messages yet." compact className="p-3 text-xs" />
          ) : (
            <>
              <AgentChatFinalItems
                agentId={agentId}
                name={name}
                avatarSeed={avatarSeed}
                avatarUrl={avatarUrl}
                chatItems={chatItems}
                autoExpandThinking={autoExpandThinking}
                lastThinkingItemIndex={lastThinkingItemIndex}
              />
              {liveThinkingText ? (
                <details
                  className="rounded-md border border-border/70 bg-muted/55 text-[11px] text-muted-foreground"
                  open={status === "running" && autoExpandThinking}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.11em] [&::-webkit-details-marker]:hidden">
                    <AgentAvatar seed={avatarSeed} name={name} avatarUrl={avatarUrl} size={22} />
                    <ChevronRight className="h-3 w-3 shrink-0 transition-transform duration-200 [[open]>&]:rotate-90" />
                    <span>Thinking</span>
                    {status === "running" ? (
                      <span className="typing-dots" aria-hidden="true">
                        <span />
                        <span />
                        <span />
                      </span>
                    ) : null}
                  </summary>
                  <div className="px-2 pb-2 text-foreground">
                    <div className="whitespace-pre-wrap break-words">{liveThinkingText}</div>
                  </div>
                </details>
              ) : null}
              {liveAssistantText ? (
                <div className="agent-markdown min-w-0 overflow-hidden rounded-md border border-transparent px-0.5 opacity-85">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{liveAssistantText}</ReactMarkdown>
                </div>
              ) : null}
              {showTypingIndicator ? (
                <div
                  className="flex items-center gap-2 rounded-md border border-border/70 bg-muted/55 px-2 py-1.5 text-[11px] text-muted-foreground"
                  role="status"
                  aria-live="polite"
                  data-testid="agent-typing-indicator"
                >
                  <AgentAvatar seed={avatarSeed} name={name} avatarUrl={avatarUrl} size={22} />
                  <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.11em]">
                    Thinking
                  </span>
                  <span className="typing-dots" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                  </span>
                </div>
              ) : null}
              <div ref={chatBottomRef} />
            </>
          )}
        </div>
      </div>

      {showJumpToLatest ? (
        <button
          type="button"
          className="absolute bottom-3 left-1/2 z-10 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-md border border-border/80 bg-card/95 px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground shadow-sm transition hover:bg-muted/70"
          onClick={() => {
            setPinned(true);
            scrollChatToBottom();
          }}
          aria-label="Jump to latest"
        >
          Jump to latest
        </button>
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

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key !== "Enter" || event.shiftKey) return;
      if (event.defaultPrevented) return;
      event.preventDefault();
      const value = localRef.current?.value ?? "";
      const trimmed = value.trim();
      if (trimmed) {
        onSend(trimmed);
      }
    },
    [onSend]
  );

  const handleClickSend = useCallback(() => {
    const value = localRef.current?.value ?? "";
    const trimmed = value.trim();
    if (trimmed) {
      onSend(trimmed);
    }
  }, [onSend]);

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
    <div className="flex items-end gap-2">
      <textarea
        ref={handleRef}
        rows={1}
        defaultValue={initialDraft}
        className="flex-1 resize-none rounded-md border border-border/80 bg-card/75 px-3 py-2 text-[11px] text-foreground outline-none transition focus:border-ring"
        style={{ maxHeight: 160 }}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="type a message"
      />
      {running ? (
        <button
          className="rounded-md border border-border/80 bg-card/70 px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground shadow-sm transition hover:bg-muted/70 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
          type="button"
          onClick={onStop}
          disabled={!canSend || stopBusy}
        >
          {stopBusy ? "Stopping" : "Stop"}
        </button>
      ) : null}
      <button
        className="rounded-md border border-transparent bg-primary px-3 py-2 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-primary-foreground shadow-sm transition hover:brightness-110 disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
        type="button"
        onClick={handleClickSend}
        disabled={sendDisabled}
      >
        Send
      </button>
    </div>
  );
});

export const AgentChatPanel = ({
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
  onCompact,
  isCompacting = false,
  lastCompactedAt = null,
  viewingSessionKey,
  viewingSessionHistory = [],
  viewingSessionLoading = false,
  onExitSessionView,
}: AgentChatPanelProps) => {
  const recentlyCompacted = useRecentlyCompacted(lastCompactedAt);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollToBottomNextOutputRef = useRef(false);
  const plainDraftRef = useRef(agent.draft);

  const resizeDraft = useCallback(() => {
    const el = draftRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxH = Math.min(el.scrollHeight, 160); // cap at ~8 lines
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

  const chatItems = useMemo(
    () =>
      buildFinalAgentChatItems({
        outputLines: agent.outputLines,
        showThinkingTraces: agent.showThinkingTraces,
        toolCallingEnabled: agent.toolCallingEnabled,
      }),
    [agent.outputLines, agent.showThinkingTraces, agent.toolCallingEnabled]
  );
  const liveAssistantText = agent.streamText ? normalizeAssistantDisplayText(agent.streamText) : "";
  const liveThinkingText =
    agent.showThinkingTraces && agent.thinkingTrace ? agent.thinkingTrace.trim() : "";
  const hasLiveAssistantText = Boolean(liveAssistantText.trim());
  const hasVisibleLiveThinking = Boolean(liveThinkingText.trim());
  const latestUserOutputIndex = useMemo(() => {
    let latestUserIndex = -1;
    for (let index = agent.outputLines.length - 1; index >= 0; index -= 1) {
      const line = agent.outputLines[index]?.trim();
      if (!line) continue;
      if (line.startsWith(">")) {
        latestUserIndex = index;
        break;
      }
    }
    return latestUserIndex;
  }, [agent.outputLines]);
  const hasSavedThinkingSinceLatestUser = useMemo(() => {
    if (!agent.showThinkingTraces || latestUserOutputIndex < 0) return false;
    for (
      let index = latestUserOutputIndex + 1;
      index < agent.outputLines.length;
      index += 1
    ) {
      if (isTraceMarkdown(agent.outputLines[index] ?? "")) {
        return true;
      }
    }
    return false;
  }, [agent.outputLines, agent.showThinkingTraces, latestUserOutputIndex]);
  const hasSavedAssistantSinceLatestUser = useMemo(() => {
    if (latestUserOutputIndex < 0) return false;
    for (
      let index = latestUserOutputIndex + 1;
      index < agent.outputLines.length;
      index += 1
    ) {
      const line = agent.outputLines[index]?.trim() ?? "";
      if (!line) continue;
      if (line.startsWith(">")) continue;
      if (isTraceMarkdown(line)) continue;
      if (isToolMarkdown(line)) continue;
      return true;
    }
    return false;
  }, [agent.outputLines, latestUserOutputIndex]);
  const lastThinkingItemIndex = useMemo(() => {
    for (let index = chatItems.length - 1; index >= 0; index -= 1) {
      if (chatItems[index]?.kind === "thinking") {
        return index;
      }
    }
    return -1;
  }, [chatItems]);
  const autoExpandThinking =
    agent.status === "running" &&
    !hasSavedAssistantSinceLatestUser &&
    (lastThinkingItemIndex >= 0 || hasVisibleLiveThinking);
  const showTypingIndicator =
    agent.status === "running" &&
    !hasLiveAssistantText &&
    !hasVisibleLiveThinking &&
    !hasSavedThinkingSinceLatestUser;

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
                  size={96}
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

              <div className="mt-2 grid max-w-md gap-2 sm:grid-cols-[minmax(0,1fr)_128px]">
                <label className="flex min-w-0 flex-col gap-1 font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <span>Model</span>
                  <select
                    className="h-8 w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded-md border border-border bg-card/75 px-2 text-[11px] font-semibold text-foreground"
                    aria-label="Model"
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
                      <option key={option.value} value={option.value}>
                        {option.label}
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
                  {onCompact ? (
                    <button
                      type="button"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/80 bg-card/70 text-muted-foreground transition hover:border-border hover:bg-muted/65 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label="Compact context & save to memory"
                      title="Compact context & save to memory"
                      onClick={onCompact}
                      disabled={isCompacting}
                    >
                      <Archive className={`h-3.5 w-3.5 ${isCompacting ? "animate-spin" : ""}`} />
                    </button>
                  ) : null}
                  {recentlyCompacted ? (
                    <span className="shrink-0 font-mono text-[9px] text-emerald-500 animate-pulse">
                      ✓ Compacted
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col gap-3 px-3 pb-3 sm:px-4 sm:pb-4">
        {viewingSessionKey ? (
          <div className="relative flex flex-1 flex-col overflow-hidden rounded-md border border-border/80 bg-card/75">
            <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
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
                <div className="flex min-w-0 flex-col gap-3 text-xs text-foreground">
                  {viewingSessionHistory.map((line, i) =>
                    line.startsWith("> ") ? (
                      <div
                        key={`hist-${i}`}
                        className="rounded-md border border-border/70 bg-muted/70 px-3 py-2 text-foreground"
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{line}</ReactMarkdown>
                      </div>
                    ) : (
                      <div
                        key={`hist-${i}`}
                        className="agent-markdown min-w-0 overflow-hidden rounded-md border border-transparent px-0.5"
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{line}</ReactMarkdown>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
        <AgentChatTranscript
          agentId={agent.agentId}
          name={agent.name}
          avatarSeed={avatarSeed}
          avatarUrl={agent.avatarUrl ?? null}
          status={agent.status}
          chatItems={chatItems}
          autoExpandThinking={autoExpandThinking}
          lastThinkingItemIndex={lastThinkingItemIndex}
          liveThinkingText={liveThinkingText}
          liveAssistantText={liveAssistantText}
          showTypingIndicator={showTypingIndicator}
          outputLineCount={agent.outputLines.length}
          liveAssistantCharCount={agent.streamText?.length ?? 0}
          liveThinkingCharCount={agent.thinkingTrace?.length ?? 0}
          scrollToBottomNextOutputRef={scrollToBottomNextOutputRef}
        />
        )}

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
      </div>
    </div>
  );
};
