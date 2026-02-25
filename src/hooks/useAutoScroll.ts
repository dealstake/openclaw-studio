/**
 * useAutoScroll — shared hook for chat-style auto-scrolling containers.
 *
 * Handles:
 * - Auto-scroll to bottom when content grows (via ResizeObserver)
 * - Pinned state detection (are we near the bottom?)
 * - User scroll-up detection that pauses auto-scroll
 * - Initial scroll-to-bottom on mount/content load
 * - "Jump to latest" button visibility
 *
 * Design principles:
 * - ALL event listeners are passive (never block the browser's scroll thread)
 * - NO event.stopPropagation() (preserves native scroll chain / momentum)
 * - Uses touchstart (not touchmove) for user-scroll detection to avoid
 *   interfering with iOS momentum scrolling
 * - All auto-scroll uses instant scrollTop assignment (no CSS animation)
 * - Only explicit "jump to latest" uses smooth scrolling
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { isNearBottom } from "@/lib/dom";

/** Threshold in pixels from the bottom to consider "pinned" */
const PINNED_THRESHOLD = 300;
/** How long after user touch-starts to consider them "actively scrolling" */
const USER_SCROLL_TIMEOUT_MS = 1500;
/** Max RAF retries for initial scroll */
const INITIAL_SCROLL_RAF_RETRIES = 8;

export interface UseAutoScrollOptions {
  /** Number of content items — used to detect new content arriving */
  contentCount: number;
  /** Whether to force-scroll on next content change (e.g., after sending a message) */
  forceScrollRef?: React.MutableRefObject<boolean>;
}

export interface UseAutoScrollResult {
  /** Ref to attach to the scroll container */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Ref to place at the bottom of the content (optional, for measurement) */
  bottomRef: React.RefObject<HTMLDivElement | null>;
  /** Whether auto-scroll is pinned to the bottom */
  isPinned: boolean;
  /** Whether to show the "Jump to latest" button */
  showJumpToLatest: boolean;
  /** Call this to scroll to the bottom (smooth = animated, for user clicks) */
  scrollToBottom: (smooth?: boolean) => void;
  /** Call this when the user clicks "Jump to latest" */
  jumpToLatest: () => void;
  /** Props to spread onto the scroll container div */
  scrollContainerProps: {
    onScroll: () => void;
  };
}

export function useAutoScroll({
  contentCount,
  forceScrollRef,
}: UseAutoScrollOptions): UseAutoScrollResult {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const pinnedRef = useRef(true);
  const userScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialScrollDone = useRef(false);
  const initialTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const lastScrollHeightRef = useRef(0);
  const [isPinned, setIsPinned] = useState(true);

  // -- Core scroll helper --------------------------------------------------
  const scrollToBottom = useCallback((smooth?: boolean) => {
    const el = scrollRef.current;
    if (!el) return;
    if (userScrollingRef.current) return;
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  const setPinned = useCallback((next: boolean) => {
    if (pinnedRef.current === next) return;
    pinnedRef.current = next;
    setIsPinned(next);
  }, []);

  const updatePinnedFromScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setPinned(
      isNearBottom(
        {
          scrollTop: el.scrollTop,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        },
        PINNED_THRESHOLD,
      ),
    );
  }, [setPinned]);

  const scheduleScrollToBottom = useCallback(() => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      scrollToBottom();
    });
  }, [scrollToBottom]);

  // -- Passive touch/wheel listeners for user-scroll detection -------------
  // These are registered as passive event listeners directly on the DOM
  // element (not via React props) to guarantee they never block scrolling.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const markUserScrolling = () => {
      // Only mark as user-scrolling if NOT near bottom
      const atBottom = isNearBottom(
        {
          scrollTop: el.scrollTop,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        },
        PINNED_THRESHOLD,
      );
      if (!atBottom) {
        userScrollingRef.current = true;
        if (userScrollTimeoutRef.current) {
          clearTimeout(userScrollTimeoutRef.current);
        }
        userScrollTimeoutRef.current = setTimeout(() => {
          userScrollingRef.current = false;
        }, USER_SCROLL_TIMEOUT_MS);
      }
    };

    // touchstart fires ONCE when the user puts their finger down.
    // This is the correct event for detecting user intent — it fires
    // before momentum scrolling starts, and crucially, it also fires
    // when the user touches to STOP momentum (which is the bug Mike reported).
    const onTouchStart = () => {
      // When user touches during momentum scroll, the browser stops momentum.
      // We need to immediately allow re-pinning by clearing the user-scrolling flag
      // and letting the next scroll event re-evaluate the pinned state.
      if (userScrollingRef.current) {
        userScrollingRef.current = false;
        if (userScrollTimeoutRef.current) {
          clearTimeout(userScrollTimeoutRef.current);
          userScrollTimeoutRef.current = null;
        }
      }
    };

    // touchend: after user lifts finger, check if we're near bottom and re-evaluate
    const onTouchEnd = () => {
      // Small delay to let the scroll position settle after the last touch
      setTimeout(() => {
        updatePinnedFromScroll();
        // If not near bottom after touch ended, mark as user-scrolling briefly
        // to prevent auto-scroll from pulling us back during momentum coast
        const atBottom = isNearBottom(
          {
            scrollTop: el.scrollTop,
            scrollHeight: el.scrollHeight,
            clientHeight: el.clientHeight,
          },
          PINNED_THRESHOLD,
        );
        if (!atBottom) {
          userScrollingRef.current = true;
          if (userScrollTimeoutRef.current) {
            clearTimeout(userScrollTimeoutRef.current);
          }
          userScrollTimeoutRef.current = setTimeout(() => {
            userScrollingRef.current = false;
          }, USER_SCROLL_TIMEOUT_MS);
        }
      }, 100);
    };

    // wheel: for desktop trackpad/mouse wheel scrolling up
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) {
        markUserScrolling();
      }
    };

    // All listeners are passive — they NEVER call preventDefault() or
    // stopPropagation(), so they cannot interfere with the browser's
    // native scroll handling or momentum physics.
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("wheel", onWheel, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
    };
  }, [updatePinnedFromScroll]);

  // -- Initial scroll on content load --------------------------------------
  useEffect(() => {
    if (contentCount > 0 && !initialScrollDone.current) {
      initialScrollDone.current = true;

      // RAF-based retries for fast renders
      let rafRetries = 0;
      const tryScrollRaf = () => {
        scrollToBottom();
        const el = scrollRef.current;
        if (el) {
          const gap = el.scrollHeight - el.clientHeight - el.scrollTop;
          if (gap > 50 && rafRetries < INITIAL_SCROLL_RAF_RETRIES) {
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

      // Timeout-based fallbacks for slow mobile DOM rendering
      const t1 = setTimeout(() => {
        scrollToBottom();
        updatePinnedFromScroll();
      }, 300);
      const t2 = setTimeout(() => {
        scrollToBottom();
        updatePinnedFromScroll();
      }, 800);
      initialTimersRef.current = [t1, t2];

      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
    if (contentCount === 0) {
      initialScrollDone.current = false;
    }
  }, [contentCount, scrollToBottom, updatePinnedFromScroll]);

  // -- Scroll on new content -----------------------------------------------
  useEffect(() => {
    if (forceScrollRef?.current) {
      forceScrollRef.current = false;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToBottom();
        });
      });
      return;
    }

    if (pinnedRef.current) {
      scheduleScrollToBottom();
    }
  }, [contentCount, scheduleScrollToBottom, scrollToBottom, forceScrollRef]);

  // -- ResizeObserver for streaming content growth --------------------------
  useEffect(() => {
    const el = scrollRef.current;
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
    if (content) observer.observe(content);

    return () => observer.disconnect();
  }, [scheduleScrollToBottom, contentCount]);

  // -- Cleanup -------------------------------------------------------------
  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) {
        cancelAnimationFrame(scrollFrameRef.current);
      }
      if (userScrollTimeoutRef.current !== null) {
        clearTimeout(userScrollTimeoutRef.current);
      }
      for (const t of initialTimersRef.current) {
        clearTimeout(t);
      }
    };
  }, []);

  // -- "Jump to latest" handler -------------------------------------------
  const jumpToLatest = useCallback(() => {
    userScrollingRef.current = false;
    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
      userScrollTimeoutRef.current = null;
    }
    setPinned(true);
    scrollToBottom(true);
  }, [setPinned, scrollToBottom]);

  const showJumpToLatest = !isPinned && contentCount > 0;

  return {
    scrollRef,
    bottomRef,
    isPinned,
    showJumpToLatest,
    scrollToBottom,
    jumpToLatest,
    scrollContainerProps: {
      onScroll: updatePinnedFromScroll,
    },
  };
}
