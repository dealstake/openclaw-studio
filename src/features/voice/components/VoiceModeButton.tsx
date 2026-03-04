"use client";

/**
 * VoiceModeButton — Launches the full-screen voice mode overlay.
 *
 * CRITICAL iOS Safari fix: getUserMedia MUST be called in the click handler
 * AND the stream must be KEPT ALIVE (not stopped). iOS Safari does not persist
 * getUserMedia permissions — if the stream is stopped, subsequent getUserMedia
 * calls from non-gesture contexts (like useEffect) are blocked.
 *
 * The pre-acquired stream is stored in VoiceModeProvider.micStreamRef.
 * When Scribe.connect() calls getUserMedia internally (from a WebSocket open
 * handler), iOS Safari sees an active mic stream and allows it.
 * The pre-acquired stream is cleaned up after Scribe connects or on close.
 */

import React, { useCallback } from "react";
import { Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceModeSafe } from "../providers/VoiceModeProvider";

interface VoiceModeButtonProps {
  agentId: string;
  variant?: "inline" | "primary";
  className?: string;
}

export const VoiceModeButton = React.memo(function VoiceModeButton({
  agentId,
  variant = "inline",
  className,
}: VoiceModeButtonProps) {
  const voiceMode = useVoiceModeSafe();

  const handleClick = useCallback(async () => {
    if (!voiceMode) return;

    try {
      console.log("[VoiceModeButton] Acquiring mic in click handler (user gesture)...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      // KEEP the stream alive! iOS Safari requires an active stream for
      // subsequent getUserMedia calls to succeed without re-prompting.
      // Store in provider ref so the bridge can clean it up after Scribe connects.
      voiceMode.micStreamRef.current = stream;
      console.log("[VoiceModeButton] Mic stream acquired and stored, opening voice mode...");
    } catch (err) {
      console.error("[VoiceModeButton] Mic permission denied:", err);
      // Still open voice mode — bridge will show mic-denied error state
    }

    voiceMode.openVoiceMode(agentId);
  }, [voiceMode, agentId]);

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
