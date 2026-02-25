import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Auto-hide header based on chat scroll position.
 * - Header visible when scrolled near top (< threshold)
 * - Header hidden when scrolled down past threshold
 * - Header revealed on hover over top hover zone
 * - Header revealed when scrolling up quickly
 */
export function useAutoHideHeader(options?: {
  /** Scroll distance before header hides (default 50px) */
  threshold?: number;
  /** Ref to the scroll container element (preferred over scrollSelector) */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
  /** Selector for the scroll container (fallback if scrollContainerRef not provided) */
  scrollSelector?: string;
  /** Disable auto-hide (e.g. on mobile where header should always show) */
  disabled?: boolean;
}) {
  const {
    threshold = 50,
    scrollContainerRef,
    scrollSelector = '[data-testid="agent-chat-scroll"]',
    disabled = false,
  } = options ?? {};

  const [headerHidden, setHeaderHidden] = useState(false);
  const [hoverReveal, setHoverReveal] = useState(false);
  const lastScrollTop = useRef(0);
  const scrollUpAccum = useRef(0);

  useEffect(() => {
    if (disabled) return;

    const container =
      scrollContainerRef?.current ?? document.querySelector(scrollSelector);
    if (!container) return;

    function handleScroll() {
      const el = container as HTMLElement;
      const scrollTop = el.scrollTop;
      const delta = scrollTop - lastScrollTop.current;

      if (scrollTop <= threshold) {
        setHeaderHidden(false);
        scrollUpAccum.current = 0;
      } else if (delta < 0) {
        scrollUpAccum.current += Math.abs(delta);
        if (scrollUpAccum.current > 30) {
          setHeaderHidden(false);
        }
      } else if (delta > 0) {
        scrollUpAccum.current = 0;
        setHeaderHidden(true);
      }

      lastScrollTop.current = scrollTop;
    }

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [disabled, scrollContainerRef, scrollSelector, threshold]);

  const onHoverZoneEnter = useCallback(() => {
    if (!disabled) setHoverReveal(true);
  }, [disabled]);

  const onHoverZoneLeave = useCallback(() => {
    setHoverReveal(false);
  }, []);

  const isVisible = disabled || !headerHidden || hoverReveal;

  return { isVisible, onHoverZoneEnter, onHoverZoneLeave };
}
