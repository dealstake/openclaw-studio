"use client";

/**
 * useVoiceModeShortcut — Global keyboard shortcut for voice mode.
 *
 * Ctrl+Shift+V (or Cmd+Shift+V on macOS) toggles voice mode.
 * - If closed: opens with the provided agentId
 * - If open: closes
 * - If minimized: expands
 */

import { useEffect } from "react";
import { useVoiceModeSafe } from "../providers/VoiceModeProvider";

export function useVoiceModeShortcut(defaultAgentId?: string | null): void {
  const voiceMode = useVoiceModeSafe();

  useEffect(() => {
    if (!voiceMode) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (!voiceMode) return;

      // Ctrl/Cmd + Shift + V
      if (e.key === "V" && e.shiftKey && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();

        if (voiceMode.isOverlayOpen) {
          voiceMode.closeVoiceMode();
        } else if (voiceMode.isMinimized) {
          voiceMode.expandVoiceMode();
        } else if (defaultAgentId) {
          voiceMode.openVoiceMode(defaultAgentId);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [voiceMode, defaultAgentId]);
}
