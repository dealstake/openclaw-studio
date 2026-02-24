import { useEffect } from "react";

/**
 * Registers Ctrl+Shift+X (Cmd+Shift+X on Mac) to toggle the emergency panel.
 */
export function useEmergencyShortcut(onToggle: () => void) {
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toUpperCase() === "X") {
        e.preventDefault();
        onToggle();
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onToggle]);
}
