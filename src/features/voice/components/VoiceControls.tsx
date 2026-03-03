"use client";

/**
 * Voice controls for the chat composer.
 *
 * - MicButton: tap to start/stop voice input (ElevenLabs real-time STT)
 * - SpeakerToggle: toggle auto-read responses (ElevenLabs TTS)
 * - VoiceTranscriptOverlay: live transcription display while listening
 */

import React, { useCallback, useEffect, useRef } from "react";
import { Mic, Volume2, VolumeX, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UseVoiceClientReturn } from "../hooks/useVoiceClient";
import type { UseVoiceOutputReturn } from "../hooks/useVoiceOutput";

// ── Mic Button ──────────────────────────────────────────────────────────

interface MicButtonProps {
  voiceInput: UseVoiceClientReturn;
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
    isConnecting,
    transcript,
    startListening,
    stopListening,
    resetTranscript,
  } = voiceInput;

  const prevTranscriptRef = useRef("");
  const prevListeningRef = useRef(false);
  const stoppingRef = useRef(false);

  // Sync transcript to parent while listening
  useEffect(() => {
    if (transcript !== prevTranscriptRef.current) {
      prevTranscriptRef.current = transcript;
      if (transcript) {
        onTranscript(transcript);
      }
    }
  }, [transcript, onTranscript]);

  // Auto-send when listening stops
  useEffect(() => {
    if (prevListeningRef.current && !isListening && stoppingRef.current) {
      stoppingRef.current = false;
      const text = prevTranscriptRef.current.trim();
      if (text && onSend) {
        onSend(text);
        resetTranscript();
        prevTranscriptRef.current = "";
      }
    }
    prevListeningRef.current = isListening;
  }, [isListening, onSend, resetTranscript]);

  const handleToggle = useCallback(() => {
    if (isListening || isConnecting) {
      stoppingRef.current = true;
      stopListening();
    } else {
      resetTranscript();
      prevTranscriptRef.current = "";
      void startListening();
    }
  }, [isListening, isConnecting, startListening, stopListening, resetTranscript]);

  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={
        isConnecting
          ? "Connecting…"
          : isListening
            ? "Stop listening"
            : "Start voice input"
      }
      aria-pressed={isListening}
      className={cn(
        "relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        isConnecting
          ? "text-primary animate-pulse"
          : isListening
            ? "bg-red-500/20 text-red-500 hover:bg-red-500/30"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
        className,
      )}
    >
      {isConnecting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : isListening ? (
        <>
          <Mic className="h-4 w-4" />
          {/* Subtle breathing ring while listening */}
          <span className="absolute inset-[-2px] rounded-lg border-2 border-red-500/60 animate-pulse" />
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
        "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-all",
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

// ── Voice Transcript Overlay ────────────────────────────────────────────

interface VoiceTranscriptOverlayProps {
  voiceInput: UseVoiceClientReturn;
}

export const VoiceTranscriptOverlay = React.memo(
  function VoiceTranscriptOverlay({ voiceInput }: VoiceTranscriptOverlayProps) {
    const { isListening, isConnecting, transcript, error } = voiceInput;

    if (!isListening && !isConnecting) return null;

    return (
      <div className="mb-2 rounded-2xl border border-red-500/30 bg-red-500/5 px-4 py-3 shadow-lg ring-1 ring-red-500/10 backdrop-blur-xl animate-in slide-in-from-bottom-2 fade-in duration-200">
        <div className="flex items-center gap-2">
          {/* Pulsing dot */}
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
          </span>

          {isConnecting ? (
            <span className="text-sm text-muted-foreground">
              Connecting to voice…
            </span>
          ) : error ? (
            <span className="text-sm text-destructive">{error}</span>
          ) : transcript ? (
            <span className="text-sm text-foreground">{transcript}</span>
          ) : (
            <span className="text-sm text-muted-foreground">
              Listening… speak now
            </span>
          )}
        </div>
      </div>
    );
  },
);
