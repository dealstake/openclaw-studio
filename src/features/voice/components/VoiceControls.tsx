"use client";

/**
 * Voice controls for the chat composer.
 *
 * - VoiceInputControl: SpeechInput compound component (record + preview + cancel)
 *   with error recovery (toast mapping, retry logic, disabled after 3 failures)
 * - SpeakerToggle: toggle auto-read responses (ElevenLabs TTS)
 */

import React, { useCallback, useRef, useState } from "react";
import { Volume2, VolumeX, Loader2, MicOff } from "lucide-react";
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
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";
import type { UseVoiceOutputReturn } from "../hooks/useVoiceOutput";

// ── Constants ───────────────────────────────────────────────────────────

const MAX_CONSECUTIVE_FAILURES = 3;

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

// ── Voice Unavailable Fallback ──────────────────────────────────────────

interface VoiceUnavailableProps {
  onRetry: () => void;
}

function VoiceUnavailable({ onRetry }: VoiceUnavailableProps) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={onRetry}
        className={cn(
          "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg",
          "text-muted-foreground/50 transition-colors hover:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        )}
        aria-label="Voice unavailable — click to retry"
        title="Voice unavailable — click to retry"
      >
        <MicOff className="h-4 w-4" />
      </button>
    </div>
  );
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
  const failureCountRef = useRef(0);
  const [isDisabled, setIsDisabled] = useState(false);

  const handleRetry = useCallback(() => {
    failureCountRef.current = 0;
    setIsDisabled(false);
    toast.info("Voice re-enabled. Try recording again.");
  }, []);

  const incrementFailures = useCallback(() => {
    failureCountRef.current += 1;
    if (failureCountRef.current >= MAX_CONSECUTIVE_FAILURES) {
      setIsDisabled(true);
      toast.error("Voice unavailable after multiple failures. Click the mic icon to retry.");
    }
  }, []);

  const handleStart = useCallback(
    (data: SpeechInputData) => {
      // Successful start resets failure counter
      failureCountRef.current = 0;
      onStart?.(data);
    },
    [onStart],
  );

  const handleError = useCallback(
    (err: Error | Event) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("NotAllowedError") || msg.includes("Permission denied")) {
        toast.error("Microphone access denied — check browser settings.");
      } else if (msg.includes("NotFoundError") || msg.includes("DevicesNotFoundError")) {
        toast.error("No microphone found. Please connect a microphone.");
      } else if (msg.includes("NotReadableError") || msg.includes("TrackStartError")) {
        toast.error("Microphone is in use by another application.");
      } else {
        toast.error("Voice connection failed. Please try again.");
      }
      incrementFailures();
    },
    [incrementFailures],
  );

  const handleAuthError = useCallback(() => {
    toast.error("Voice session expired. Please try again.");
    incrementFailures();
  }, [incrementFailures]);

  const handleQuotaExceeded = useCallback(() => {
    toast.error("Voice quota reached. Try again later.");
    // Quota exceeded = disable immediately, no point retrying
    failureCountRef.current = MAX_CONSECUTIVE_FAILURES;
    setIsDisabled(true);
  }, []);

  const handleRateLimited = useCallback(() => {
    toast.error("Too many voice requests. Please wait a moment.");
    incrementFailures();
  }, [incrementFailures]);

  if (isDisabled) {
    return <VoiceUnavailable onRetry={handleRetry} />;
  }

  return (
    <PanelErrorBoundary name="Voice Input">
      <SpeechInput
        getToken={fetchVoiceToken}
        onChange={onChange}
        onStop={onStop}
        onStart={handleStart}
        onCancel={onCancel}
        onError={handleError}
        onAuthError={handleAuthError}
        onQuotaExceededError={handleQuotaExceeded}
        onRateLimitedError={handleRateLimited}
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
    </PanelErrorBoundary>
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
