"use client";

/**
 * Voice input hook — SDK-based wrapper around ElevenLabs `useScribe`.
 *
 * Uses the official ElevenLabs client SDK (`useScribe`).
 *
 * Features:
 * - Pre-acquires mic permission before Scribe connection (iOS Safari fix)
 * - Automatic microphone management via SDK
 * - Consolidated transcript state to prevent stale closure bugs
 * - Auto-reconnect with exponential backoff (max 3 attempts)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useScribe, type ScribeStatus } from "@/hooks/use-scribe";
import { toast } from "sonner";

// ── Types ───────────────────────────────────────────────────────────────

export interface UseVoiceClientReturn {
  /** Whether the browser supports voice input */
  isSupported: boolean;
  /** Whether actively listening (connected + receiving audio) */
  isListening: boolean;
  /** Whether connecting to the STT service */
  isConnecting: boolean;
  /** Current transcript (partial + committed combined for display) */
  transcript: string;
  /** Last committed (final) transcript text */
  finalTranscript: string;
  /** Start listening (async — requests mic + connects to STT) */
  startListening: () => Promise<void>;
  /** Stop listening */
  stopListening: () => void;
  /** Clear transcript */
  resetTranscript: () => void;
  /** Last error message */
  error: string | null;
  /** Raw SDK status for advanced consumers */
  status: ScribeStatus;
}

// ── Constants ───────────────────────────────────────────────────────────

const MAX_RECONNECT_ATTEMPTS = 3;
const BASE_RECONNECT_DELAY_MS = 1000;
const SCRIBE_MODEL_ID = "scribe_v2_realtime";

// ── Support check ───────────────────────────────────────────────────────

function checkSupport(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof WebSocket !== "undefined"
  );
}

// ── Token fetcher ───────────────────────────────────────────────────────

async function fetchToken(): Promise<string> {
  const res = await fetch("/api/voice/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "realtime_scribe" }),
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `Failed: ${res.status}` }));
    throw new Error((errBody as { error?: string }).error || `Failed to get voice token: ${res.status}`);
  }

  const data = (await res.json()) as { token: string };
  return data.token;
}

// ── Mic permission pre-acquisition ──────────────────────────────────────

/**
 * Pre-acquire microphone permission by calling getUserMedia and immediately
 * stopping the stream. This ensures the browser has granted mic access before
 * Scribe.connect() tries to acquire it internally (which happens in a WebSocket
 * open handler, outside the user gesture chain on iOS Safari).
 *
 * This follows ElevenLabs' recommended pattern from their SDK docs.
 */
async function preAcquireMicPermission(): Promise<void> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      },
    });
    // Immediately stop — we just needed the permission grant
    stream.getTracks().forEach((track) => track.stop());
  } catch (err) {
    // Re-throw with a clear message
    const msg = (err as Error).message || "";
    if (msg.includes("NotAllowedError") || msg.includes("Permission denied")) {
      throw new Error("NotAllowedError: Microphone permission denied");
    }
    throw err;
  }
}

// ── Hook ────────────────────────────────────────────────────────────────

/**
 * Consolidated transcript state to avoid stale closure bugs.
 * Both fields are updated atomically via functional setState,
 * eliminating the ref-sync timing gap that caused mic input to silently fail.
 */
interface TranscriptState {
  /** All committed (final) transcript segments concatenated */
  committed: string;
  /** Current partial transcript (in-progress speech) */
  partial: string;
}

export function useVoiceClient(): UseVoiceClientReturn {
  const [transcripts, setTranscripts] = useState<TranscriptState>({
    committed: "",
    partial: "",
  });

  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalDisconnectRef = useRef(false);
  const isSupported = checkSupport();

  const scribe = useScribe({
    modelId: SCRIBE_MODEL_ID,
    microphone: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
    commitStrategy: "vad" as never,
    vadSilenceThresholdSecs: 1.2,
    languageCode: "en",

    onPartialTranscript: (data) => {
      setTranscripts((prev) => ({
        ...prev,
        partial: data.text,
      }));
    },

    onCommittedTranscript: (data) => {
      setTranscripts((prev) => ({
        committed: prev.committed ? `${prev.committed} ${data.text}` : data.text,
        partial: "",
      }));
      reconnectAttemptsRef.current = 0;
    },

    onAuthError: () => {
      attemptReconnect();
    },

    onQuotaExceededError: () => {
      toast.error("Voice quota reached. Try again later.");
    },

    onRateLimitedError: () => {
      toast.error("Too many requests. Please wait.");
    },

    onError: (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (!(msg.includes("NotAllowedError") || msg.includes("Permission denied"))) {
        console.warn("[useVoiceClient] STT error:", msg);
      }
    },

    onDisconnect: () => {
      if (!intentionalDisconnectRef.current) {
        attemptReconnect();
      }
    },
  });

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      toast.error("Voice unavailable — please try again.");
      return;
    }

    const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current);
    reconnectAttemptsRef.current++;

    reconnectTimerRef.current = setTimeout(async () => {
      try {
        const token = await fetchToken();
        await scribe.connect({ token });
      } catch {
        // Will trigger onDisconnect → another attemptReconnect if under limit
      }
    }, delay);
  }, [scribe]);

  // Cleanup connection + reconnect timer on unmount
  useEffect(() => {
    return () => {
      intentionalDisconnectRef.current = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      scribe.disconnect();
    };
  }, [scribe]);

  const startListening = useCallback(async () => {
    if (scribe.isConnected || scribe.status === "connecting") return;

    intentionalDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;

    try {
      // Pre-acquire mic permission BEFORE Scribe.connect().
      // Scribe.connect() calls getUserMedia in a WebSocket "open" event handler,
      // which is outside the user gesture chain. By pre-acquiring here,
      // the browser caches the permission grant and Scribe's internal
      // getUserMedia succeeds even outside the gesture window.
      await preAcquireMicPermission();

      const token = await fetchToken();
      const connectPromise = scribe.connect({ token });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout — microphone may be blocked")), 15000),
      );
      await Promise.race([connectPromise, timeoutPromise]);
    } catch (err) {
      const msg = (err as Error).message || "Failed to start voice input";
      if (msg.includes("NotAllowedError") || msg.includes("Permission denied")) {
        // Don't toast — parent component shows MicPermissionDialog
      } else if (msg.includes("timeout") || msg.includes("Timeout")) {
        toast.error("Voice connection timed out — check microphone permissions.");
      } else {
        toast.error("Voice connection failed — please try again.");
      }
      try { scribe.disconnect(); } catch { /* ignore */ }
      throw err; // Re-throw so callers can handle
    }
  }, [scribe]);

  const stopListening = useCallback(() => {
    intentionalDisconnectRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    scribe.disconnect();
  }, [scribe]);

  const resetTranscript = useCallback(() => {
    setTranscripts({ committed: "", partial: "" });
    scribe.clearTranscripts();
  }, [scribe]);

  // Derive display values from consolidated state
  const displayTranscript = transcripts.committed
    ? transcripts.partial
      ? `${transcripts.committed} ${transcripts.partial}`
      : transcripts.committed
    : transcripts.partial;

  const isListening = scribe.isConnected || scribe.isTranscribing;
  const isConnecting = scribe.status === "connecting";

  return {
    isSupported,
    isListening,
    isConnecting,
    transcript: displayTranscript,
    finalTranscript: transcripts.committed,
    startListening,
    stopListening,
    resetTranscript,
    error: scribe.error,
    status: scribe.status,
  };
}
