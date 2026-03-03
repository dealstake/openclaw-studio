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
  /** "inline" = small icon in pill; "primary" = large circular morphing button */
  variant?: "inline" | "primary";
  className?: string;
}

export const VoiceModeButton = React.memo(function VoiceModeButton({
  agentId,
  variant = "inline",
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
