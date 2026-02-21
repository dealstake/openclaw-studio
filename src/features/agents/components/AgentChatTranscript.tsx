import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";

import type { MessagePart } from "@/lib/chat/types";
import { isNearBottom } from "@/lib/dom";
import { AgentChatView } from "./AgentChatView";
import { ChatEmptyState } from "./ChatEmptyState";

export const AgentChatTranscript = memo(function AgentChatTranscript({
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
  const initialScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollHeightRef = useRef(0);
  const [isPinned, setIsPinned] = useState(true);

  // ---------------------------------------------------------------------------
  // Core scroll helper — ALWAYS instant except for explicit user-triggered
  // "Jump to latest" clicks. CSS scroll-smooth was removed from the container
  // because it made ALL scrolls animate — on 40K+ pixel conversations, smooth
  // scrolling from top to bottom takes seconds, making the chat unusable.
  // ---------------------------------------------------------------------------
  const scrollToBottom = useCallback((smooth?: boolean) => {
    const el = chatRef.current;
    if (!el) return;
    if (userScrollingRef.current) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      // Instant: direct assignment, no animation
      el.scrollTop = el.scrollHeight;
    }
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
        300
      )
    );
  }, [setPinned]);

  const scheduleScrollToBottom = useCallback(() => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      scrollToBottom();
    });
  }, [scrollToBottom]);

  useEffect(() => {
    updatePinnedFromScroll();
  }, [updatePinnedFromScroll]);

  // ---------------------------------------------------------------------------
  // Initial scroll: on page load / refresh / agent switch.
  // Uses aggressive retry strategy because on real mobile devices, rendering
  // hundreds of messages can take 300-500ms+ and the DOM height keeps growing.
  // ---------------------------------------------------------------------------
  const partCount = messageParts.length;
  useEffect(() => {
    if (partCount > 0 && !initialScrollDone.current) {
      initialScrollDone.current = true;

      // Attempt 1: immediate after 2 frames (handles fast renders)
      let rafRetries = 0;
      const tryScrollRaf = () => {
        scrollToBottom();
        const el = chatRef.current;
        if (el) {
          const gap = el.scrollHeight - el.clientHeight - el.scrollTop;
          if (gap > 50 && rafRetries < 8) {
            rafRetries++;
            requestAnimationFrame(tryScrollRaf);
            return;
          }
        }
        updatePinnedFromScroll();
      };
      requestAnimationFrame(() => {
        requestAnimationFrame(tryScrollRaf);
      });

      // Attempt 2: delayed fallback (handles slow mobile DOM rendering)
      // Fires after 300ms and 800ms as safety nets
      const timer1 = setTimeout(() => {
        scrollToBottom();
        updatePinnedFromScroll();
      }, 300);
      const timer2 = setTimeout(() => {
        scrollToBottom();
        updatePinnedFromScroll();
      }, 800);
      initialScrollTimerRef.current = timer2;

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
    if (partCount === 0) {
      initialScrollDone.current = false;
    }
  }, [partCount, scrollToBottom, updatePinnedFromScroll]);

  const showJumpToLatest = !isPinned && partCount > 0;

  // Scroll on new message parts (streaming / new messages arriving)
  useEffect(() => {
    const shouldForceScroll = scrollToBottomNextOutputRef.current;
    if (shouldForceScroll) {
      scrollToBottomNextOutputRef.current = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom();
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
    scrollToBottom,
    scrollToBottomNextOutputRef,
  ]);

  // ResizeObserver: auto-scroll during streaming when content height changes.
  // During streaming, individual text parts grow (content mutates) without
  // the messageParts array length changing.
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

    const content = el.firstElementChild;
    if (content) {
      observer.observe(content);
    }

    return () => observer.disconnect();
  }, [scheduleScrollToBottom, partCount]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
      if (userScrollTimeoutRef.current !== null) {
        clearTimeout(userScrollTimeoutRef.current);
      }
      if (initialScrollTimerRef.current !== null) {
        clearTimeout(initialScrollTimerRef.current);
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
          className="h-full overflow-y-auto overflow-x-hidden py-3 pb-36 sm:py-4 sm:pb-40"
          onScroll={() => updatePinnedFromScroll()}
          onWheel={(event) => {
            event.stopPropagation();
            // Detect manual scroll-up to prevent auto-scroll from fighting user
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
                scrollToBottom(true);
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
