"use client";

/**
 * VoiceModeButton — Launches the full-screen voice mode overlay.
 *
 * Placed in the chat composer. Long-press or click opens voice mode
 * for the current agent. Shows a headphone icon to distinguish from
 * the inline STT mic button.
 */

import React, { useCallback } from "react";
import { Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceModeSafe } from "../providers/VoiceModeProvider";

interface VoiceModeButtonProps {
  /** Agent ID to bind voice mode to */
  agentId: string;
  className?: string;
}

export const VoiceModeButton = React.memo(function VoiceModeButton({
  agentId,
  className,
}: VoiceModeButtonProps) {
  const voiceMode = useVoiceModeSafe();

  const handleClick = useCallback(() => {
    if (!voiceMode) return;
    voiceMode.openVoiceMode(agentId);
  }, [voiceMode, agentId]);

  // Don't render if provider isn't available
  if (!voiceMode) return null;

  // Don't render if already in voice mode
  if (voiceMode.isOverlayOpen || voiceMode.isMinimized) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-lg",
        "text-muted-foreground/70 transition-colors",
        "hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "min-h-[44px] min-w-[44px]",
        className,
      )}
      aria-label="Open voice mode"
      title="Voice mode (Ctrl+Shift+V)"
    >
      <Headphones className="h-4 w-4" />
    </button>
  );
});
