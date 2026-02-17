import { useCallback, useRef, useState } from "react";

/**
 * Keyboard navigation for a listbox-style list.
 * Tracks the active (focused) index and provides handlers for
 * ArrowUp, ArrowDown, Home, End, Enter, and Space keys.
 */
export function useListNavigation(
  itemCount: number,
  onActivate: (index: number) => void
) {
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const focusItem = useCallback((index: number) => {
    const container = containerRef.current;
    if (!container) return;
    const items = container.querySelectorAll<HTMLElement>('[role="option"]');
    items[index]?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (itemCount === 0) return;

      let nextIndex = activeIndex;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          nextIndex = activeIndex < itemCount - 1 ? activeIndex + 1 : 0;
          break;
        case "ArrowUp":
          e.preventDefault();
          nextIndex = activeIndex > 0 ? activeIndex - 1 : itemCount - 1;
          break;
        case "Home":
          e.preventDefault();
          nextIndex = 0;
          break;
        case "End":
          e.preventDefault();
          nextIndex = itemCount - 1;
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < itemCount) {
            onActivate(activeIndex);
          }
          return;
        default:
          return;
      }

      setActiveIndex(nextIndex);
      focusItem(nextIndex);
    },
    [activeIndex, itemCount, onActivate, focusItem]
  );

  return { activeIndex, setActiveIndex, containerRef, handleKeyDown };
}
