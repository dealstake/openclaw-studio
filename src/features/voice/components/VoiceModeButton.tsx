"use client";

/**
 * VoiceModeButton — Launches the full-screen voice mode overlay.
 *
 * CRITICAL: The `onActivate` callback MUST call startVoiceMode from the bridge,
 * which runs getUserMedia + Scribe.connect in the same user gesture chain.
 * This is the ONLY way to make voice mode work on iOS Safari.
 */

import React, { useCallback } from "react";
import { Headphones } from "lucide-react";
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
          "relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground shadow-lg",
          "ring-1 ring-white/[0.06] backdrop-blur-xl",
          "hover:brightness-110 active:scale-90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
        aria-label="Open voice mode"
        title="Voice mode (Ctrl+Shift+V)"
      >
        <Headphones className="h-[18px] w-[18px]" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-lg",
        "text-muted-foreground/70 transition-colors",
        "hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      aria-label="Open voice mode"
      title="Voice mode (Ctrl+Shift+V)"
    >
      <Headphones className="h-4 w-4" />
    </button>
  );
});
