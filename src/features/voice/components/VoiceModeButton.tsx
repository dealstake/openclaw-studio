"use client";

/**
 * VoiceModeButton — Launches the full-screen voice mode overlay.
 *
 * CRITICAL: Starts STT connection in the click handler (user gesture)
 * so iOS Safari allows getUserMedia access. The bridge registers its
 * startListeningNow via the provider, and we call it here synchronously.
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
    // Open voice mode overlay
    voiceMode.openVoiceMode(agentId);
    // Start STT immediately in the user gesture handler chain
    // This is critical for iOS Safari which requires getUserMedia from a user gesture
    void voiceMode.startListeningFromGesture();
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
