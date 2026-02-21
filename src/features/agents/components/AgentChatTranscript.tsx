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
  const lastScrollHeightRef = useRef(0);
  const [isPinned, setIsPinned] = useState(true);

  /** Scroll to bottom of chat. Instant for initial load, smooth for streaming updates. */
  const scrollChatToBottom = useCallback((instant?: boolean) => {
    const el = chatRef.current;
    if (!el) return;
    // Skip if user is actively scrolling up
    if (userScrollingRef.current) return;
    if (instant) {
      // For initial load: bypass CSS scroll-behavior by setting scrollTop directly.
      // CSS `scroll-smooth` on the container can override JS `behavior: "instant"`
      // in some browsers, causing a slow animated scroll on long conversations.
      el.style.scrollBehavior = "auto";
      el.scrollTop = el.scrollHeight;
      // Restore smooth scrolling after a frame
      requestAnimationFrame(() => {
        el.style.scrollBehavior = "";
      });
    } else {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: "smooth",
      });
    }
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

  // Force scroll to bottom on initial content load and when switching agents.
  // For long conversations, the DOM may need multiple frames to fully render,
  // so we retry the instant scroll a few times to ensure we reach the bottom.
  const partCount = messageParts.length;
  useEffect(() => {
    if (partCount > 0 && !initialScrollDone.current) {
      initialScrollDone.current = true;
      let retries = 0;
      const maxRetries = 5;
      const tryScroll = () => {
        const el = chatRef.current;
        if (!el) return;
        scrollChatToBottom(true);
        // Check if we actually reached the bottom; if not, retry
        const atBottom = el.scrollHeight - el.clientHeight - el.scrollTop < 50;
        if (!atBottom && retries < maxRetries) {
          retries++;
          requestAnimationFrame(tryScroll);
        } else {
          // After initial scroll settles, update pinned state
          updatePinnedFromScroll();
        }
      };
      // Start after 2 frames to let React render
      requestAnimationFrame(() => {
        requestAnimationFrame(tryScroll);
      });
    }
    if (partCount === 0) {
      initialScrollDone.current = false;
    }
  }, [partCount, scrollChatToBottom, updatePinnedFromScroll]);

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
