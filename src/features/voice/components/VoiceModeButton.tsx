"use client";

/**
 * VoiceModeButton — Launches the full-screen voice mode overlay.
 *
 * CRITICAL: The `onActivate` callback MUST call startVoiceMode from the bridge,
 * which runs getUserMedia + Scribe.connect in the same user gesture chain.
 * This is the ONLY way to make voice mode work on iOS Safari.
 */

import React, { useCallback } from "react";
import { AudioWaveform } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceModeSafe } from "../providers/VoiceModeProvider";

interface VoiceModeButtonProps {
  agentId: string;
  /** Called when button is clicked — must call bridge.startVoiceMode(agentId) */
  onActivate?: (agentId: string) => void;
  variant?: "inline" | "primary";
  className?: string;
}

export const VoiceModeButton = React.memo(function VoiceModeButton({
  agentId,
  onActivate,
  variant = "inline",
  className,
}: VoiceModeButtonProps) {
  const voiceMode = useVoiceModeSafe();

  const handleClick = useCallback(() => {
    if (onActivate) {
      // Use the bridge's startVoiceMode (handles getUserMedia + Scribe in gesture chain)
      onActivate(agentId);
    } else if (voiceMode) {
      // Fallback: just open the overlay (desktop keyboard shortcut path)
      voiceMode.openVoiceMode(agentId);
    }
  }, [onActivate, voiceMode, agentId]);

  if (!voiceMode) return null;
  if (voiceMode.isOverlayOpen || voiceMode.isMinimized) return null;

  if (variant === "primary") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "relative flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground shadow-sm",
          "ring-1 ring-white/[0.06] transition-all",
          "hover:bg-primary/90 active:scale-95",
          "focus-ring",
          className,
        )}
        aria-label="Open voice mode"
        title="Voice mode (Ctrl+Shift+V)"
      >
        <AudioWaveform className="h-[18px] w-[18px]" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full",
        "text-muted-foreground/70 transition-colors",
        "hover:bg-muted/50 hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-0",
        className,
      )}
      aria-label="Open voice mode"
      title="Voice mode (Ctrl+Shift+V)"
    >
      <AudioWaveform className="h-4 w-4" />
    </button>
  );
});
