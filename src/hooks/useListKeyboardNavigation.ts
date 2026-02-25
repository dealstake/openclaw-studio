"use client";

import { useCallback, useRef } from "react";

/**
 * Roving tabindex keyboard navigation for lists.
 * Supports ArrowUp, ArrowDown, Home, End, and Enter.
 *
 * Usage:
 * 1. Spread `getContainerProps()` on the list container.
 * 2. Spread `getItemProps(index)` on each list item.
 * 3. Items should be focusable elements (buttons, links) or have tabIndex.
 *
 * @param itemSelector - CSS selector for focusable items within the container (default: '[data-list-item]')
 * @param onSelect - Called with the focused element when Enter is pressed
 */
export function useListKeyboardNavigation({
  itemSelector = "[data-list-item]",
  onSelect,
}: {
  itemSelector?: string;
  onSelect?: (el: HTMLElement, index: number) => void;
} = {}) {
  const containerRef = useRef<HTMLElement | null>(null);

  const getItems = useCallback((): HTMLElement[] => {
    if (!containerRef.current) return [];
    return Array.from(containerRef.current.querySelectorAll<HTMLElement>(itemSelector));
  }, [itemSelector]);

  const focusItem = useCallback((items: HTMLElement[], index: number) => {
    const target = items[index];
    if (!target) return;
    // Update roving tabindex
    items.forEach((el) => el.setAttribute("tabindex", "-1"));
    target.setAttribute("tabindex", "0");
    target.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const items = getItems();
      if (items.length === 0) return;

      const currentIndex = items.indexOf(document.activeElement as HTMLElement);

      switch (e.key) {
        case "ArrowDown": {
          e.preventDefault();
          const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
          focusItem(items, next);
          break;
        }
        case "ArrowUp": {
          e.preventDefault();
          const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
          focusItem(items, prev);
          break;
        }
        case "Home": {
          e.preventDefault();
          focusItem(items, 0);
          break;
        }
        case "End": {
          e.preventDefault();
          focusItem(items, items.length - 1);
          break;
        }
        case "Enter": {
          if (currentIndex >= 0 && onSelect) {
            e.preventDefault();
            onSelect(items[currentIndex], currentIndex);
          }
          break;
        }
      }
    },
    [getItems, focusItem, onSelect],
  );

  const getContainerProps = useCallback(
    () => ({
      ref: (el: HTMLElement | null) => {
        containerRef.current = el;
      },
      role: "listbox" as const,
      onKeyDown: handleKeyDown,
    }),
    [handleKeyDown],
  );

  const getItemProps = useCallback(
    (index: number) => ({
      "data-list-item": true,
      role: "option" as const,
      tabIndex: index === 0 ? 0 : -1,
    }),
    [],
  );

  return { getContainerProps, getItemProps };
}
