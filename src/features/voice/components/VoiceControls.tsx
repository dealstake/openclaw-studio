"use client";

/**
 * Voice controls for the chat composer.
 *
 * - VoiceInputControl: SpeechInput compound component (record + preview + cancel)
 * - SpeakerToggle: toggle auto-read responses (ElevenLabs TTS)
 */

import React, { useCallback } from "react";
import { Volume2, VolumeX, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CommitStrategy } from "@elevenlabs/client";
import {
  SpeechInput,
  SpeechInputRecordButton,
  SpeechInputPreview,
  SpeechInputCancelButton,
  type SpeechInputData,
} from "@/components/ui/speech-input";
import type { UseVoiceOutputReturn } from "../hooks/useVoiceOutput";

// ── Token fetcher ───────────────────────────────────────────────────────

async function fetchVoiceToken(): Promise<string> {
  const res = await fetch("/api/voice/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "realtime_scribe" }),
  });
  if (!res.ok) {
    throw new Error(`Failed to get voice token: ${res.status}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}

// ── Voice Input Control ─────────────────────────────────────────────────

interface VoiceInputControlProps {
  /** Called while transcript updates */
  onChange?: (data: SpeechInputData) => void;
  /** Called when recording stops — use for auto-send */
  onStop?: (data: SpeechInputData) => void;
  /** Called when recording starts */
  onStart?: (data: SpeechInputData) => void;
  /** Called when recording is cancelled */
  onCancel?: (data: SpeechInputData) => void;
  className?: string;
}

export const VoiceInputControl = React.memo(function VoiceInputControl({
  onChange,
  onStop,
  onStart,
  onCancel,
  className,
}: VoiceInputControlProps) {
  const handleError = useCallback((err: Error | Event) => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("NotAllowedError") || msg.includes("Permission denied")) {
      toast.error("Microphone access denied — check browser settings.");
    }
  }, []);

  const handleAuthError = useCallback(() => {
    toast.error("Voice session expired. Please try again.");
  }, []);

  const handleQuotaExceeded = useCallback(() => {
    toast.error("Voice quota reached. Try again later.");
  }, []);

  return (
    <SpeechInput
      getToken={fetchVoiceToken}
      onChange={onChange}
      onStop={onStop}
      onStart={onStart}
      onCancel={onCancel}
      onError={handleError}
      onAuthError={handleAuthError}
      onQuotaExceededError={handleQuotaExceeded}
      size="sm"
      modelId="scribe_v1"
      languageCode="en"
      microphone={{
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      }}
      commitStrategy={CommitStrategy.VAD}
      vadSilenceThresholdSecs={1.2}
      className={className}
    >
      <SpeechInputRecordButton
        className="text-muted-foreground hover:text-foreground"
      />
      <SpeechInputPreview placeholder="Listening…" />
      <SpeechInputCancelButton />
    </SpeechInput>
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
