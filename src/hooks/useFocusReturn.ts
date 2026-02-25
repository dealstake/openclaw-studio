"use client";

import { useEffect, useRef } from "react";

/**
 * Stores `document.activeElement` when `open` transitions to `true`,
 * and restores focus to that element when `open` transitions to `false`.
 *
 * Use for custom panels/modals that don't rely on Radix focus management.
 */
export function useFocusReturn(open: boolean): void {
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      // Capture the element that had focus before the panel opened
      triggerRef.current = document.activeElement;
    } else if (triggerRef.current) {
      // Restore focus when panel closes
      const el = triggerRef.current as HTMLElement;
      if (typeof el.focus === "function") {
        // Use requestAnimationFrame to ensure DOM has settled
        requestAnimationFrame(() => el.focus());
      }
      triggerRef.current = null;
    }
  }, [open]);
}
