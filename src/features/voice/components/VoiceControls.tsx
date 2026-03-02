"use client";

/**
 * Voice controls for the chat composer.
 *
 * - Mic button: hold to talk (push-to-talk) or tap to toggle
 * - Speaker button: toggle auto-read responses
 * - Visual feedback: pulsing animation while listening
 */

import React, { useCallback, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, VolumeX, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UseVoiceInputReturn } from "../hooks/useVoiceInput";
import type { UseVoiceOutputReturn } from "../hooks/useVoiceOutput";

// ── Mic Button ──────────────────────────────────────────────────────────

interface MicButtonProps {
  voiceInput: UseVoiceInputReturn;
  onTranscript: (text: string) => void;
  onSend?: (text: string) => void;
  className?: string;
}

export const MicButton = React.memo(function MicButton({
  voiceInput,
  onTranscript,
  onSend,
  className,
}: MicButtonProps) {
  const {
    isSupported,
    isListening,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
  } = voiceInput;

  const prevTranscriptRef = useRef("");

  // Sync transcript to parent
  useEffect(() => {
    if (transcript !== prevTranscriptRef.current) {
      prevTranscriptRef.current = transcript;
      if (transcript) {
        onTranscript(transcript);
      }
    }
  }, [transcript, onTranscript]);

  const handleToggle = useCallback(() => {
    if (isListening) {
      stopListening();
      // Auto-send on stop if we have a transcript
      const finalText = prevTranscriptRef.current.trim();
      if (finalText && onSend) {
        // Small delay to capture final words
        setTimeout(() => {
          const text = prevTranscriptRef.current.trim();
          if (text) {
            onSend(text);
            resetTranscript();
            prevTranscriptRef.current = "";
          }
        }, 300);
      }
    } else {
      resetTranscript();
      prevTranscriptRef.current = "";
      startListening();
    }
  }, [isListening, startListening, stopListening, resetTranscript, onSend]);

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={isListening ? "Stop listening" : "Start voice input"}
      aria-pressed={isListening}
      className={cn(
        "relative flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        isListening
          ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
          : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
        className,
      )}
    >
      {isListening ? (
        <>
          <MicOff className="h-4 w-4" />
          {/* Pulse animation while listening */}
          <span className="absolute inset-0 animate-ping rounded-lg bg-red-500/20" />
        </>
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </button>
  );
});

// ── Speaker Toggle ──────────────────────────────────────────────────────

interface SpeakerToggleProps {
  voiceOutput: UseVoiceOutputReturn;
  className?: string;
}

export const SpeakerToggle = React.memo(function SpeakerToggle({
  voiceOutput,
  className,
}: SpeakerToggleProps) {
  const { enabled, setEnabled, isPlaying, isLoading, stop } = voiceOutput;

  const handleToggle = useCallback(() => {
    if (isPlaying) {
      stop();
    } else {
      setEnabled(!enabled);
    }
  }, [enabled, setEnabled, isPlaying, stop]);

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={
        isPlaying
          ? "Stop speaking"
          : enabled
            ? "Disable voice responses"
            : "Enable voice responses"
      }
      aria-pressed={enabled}
      className={cn(
        "flex min-h-[36px] min-w-[36px] items-center justify-center rounded-lg transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        isPlaying
          ? "bg-primary/20 text-primary"
          : enabled
            ? "text-primary hover:bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
        className,
      )}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : enabled || isPlaying ? (
        <Volume2 className="h-4 w-4" />
      ) : (
        <VolumeX className="h-4 w-4" />
      )}
    </button>
  );
});
