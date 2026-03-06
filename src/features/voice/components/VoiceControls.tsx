"use client";

/**
 * Voice controls for the chat composer.
 *
 * VoiceInputControl: SpeechInput compound component (record + preview + cancel)
 * with error recovery (toast mapping, retry logic, disabled after 3 failures).
 *
 * AutoStopOnSilence: Monitors VAD commits and auto-stops recording after
 * sustained silence, placing captured text in the textarea for review.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { MicOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CommitStrategy } from "@elevenlabs/client";
import {
  SpeechInput,
  SpeechInputRecordButton,
  useSpeechInput,
  type SpeechInputData,
} from "@/components/ui/speech-input";
import { PanelErrorBoundary } from "@/components/PanelErrorBoundary";

// ── Constants ───────────────────────────────────────────────────────────

const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * After a VAD commit and this many ms of silence (no new partial transcripts),
 * auto-stop recording and preserve text in the textarea.
 */
const AUTO_STOP_SILENCE_MS = 3500;

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

// ── Auto-Stop on Silence ────────────────────────────────────────────────

/**
 * Invisible child component placed inside SpeechInput that monitors for
 * silence after a VAD commit and auto-stops recording.
 *
 * Uses the useSpeechInput() hook to access transcript state and stop().
 * This means it must be a direct child of <SpeechInput>.
 */
function AutoStopOnSilence() {
  const speechInput = useSpeechInput();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasCommitRef = useRef(false);

  useEffect(() => {
    if (!speechInput.isConnected) {
      // Reset when disconnected
      hasCommitRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    // Check if we have committed transcripts (VAD fired)
    if (speechInput.committedTranscripts.length > 0) {
      hasCommitRef.current = true;
    }

    // If we have commits and no active partial transcript → start silence timer
    if (hasCommitRef.current && !speechInput.partialTranscript.trim()) {
      if (!timerRef.current) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          // Auto-stop recording — text will be preserved by onStop handler
          if (speechInput.isConnected) {
            speechInput.stop();
          }
        }, AUTO_STOP_SILENCE_MS);
      }
    } else {
      // User is speaking again — cancel the timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    }
  }, [
    speechInput.isConnected,
    speechInput.committedTranscripts.length,
    speechInput.partialTranscript,
    speechInput.stop,
  ]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return null; // Invisible controller
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
  /** Called when recording stops — text preserved in textarea */
  onStop?: (data: SpeechInputData) => void;
  /** Called when recording starts */
  onStart?: (data: SpeechInputData) => void;
  /** Called when recording is cancelled — text preserved in textarea */
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
    failureCountRef.current = MAX_CONSECUTIVE_FAILURES;
    setIsDisabled(true);
  }, []);

  const handleRateLimited = useCallback(() => {
    toast.error("Too many voice requests. Please wait a moment.");
    incrementFailures();
  }, [incrementFailures]);

  const handleInsufficientAudio = useCallback(() => {
    toast.error("No audio detected. Check your microphone is working and not muted.");
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
        onInsufficientAudioActivityError={handleInsufficientAudio}
        size="sm"
        modelId="scribe_v2_realtime"
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
          className="text-muted-foreground/70 transition-colors hover:bg-muted/50 hover:text-foreground"
        />
        <AutoStopOnSilence />
      </SpeechInput>
    </PanelErrorBoundary>
  );
});
