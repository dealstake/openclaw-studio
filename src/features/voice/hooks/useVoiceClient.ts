"use client";

/**
 * Voice input hook — SDK-based wrapper around ElevenLabs `useScribe`.
 *
 * Uses the official ElevenLabs client SDK (`useScribe`).
 *
 * Features:
 * - Automatic microphone management via SDK
 * - Typed error callbacks with toast notifications
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
const SCRIBE_MODEL_ID = "scribe_v1";

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
    throw new Error(`Failed to get voice token: ${res.status}`);
  }

  const data = (await res.json()) as { token: string };
  return data.token;
}

// ── Hook ────────────────────────────────────────────────────────────────

export function useVoiceClient(): UseVoiceClientReturn {
  const [finalTranscript, setFinalTranscript] = useState("");
  const [displayTranscript, setDisplayTranscript] = useState("");
  const finalTranscriptRef = useRef(finalTranscript);
  // Sync ref in effect to avoid updating ref during render
  useEffect(() => {
    finalTranscriptRef.current = finalTranscript;
  }, [finalTranscript]);
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
      // Show committed + partial for live display
      setDisplayTranscript(() => {
        const base = finalTranscriptRef.current;
        return base ? `${base} ${data.text}` : data.text;
      });
    },

    onCommittedTranscript: (data) => {
      setFinalTranscript((prev) => {
        const combined = prev ? `${prev} ${data.text}` : data.text;
        setDisplayTranscript(combined);
        return combined;
      });
      reconnectAttemptsRef.current = 0; // Successful transcription = reset reconnect counter
    },

    onAuthError: () => {
      toast.error("Voice session expired. Reconnecting...");
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
      if (msg.includes("NotAllowedError") || msg.includes("Permission denied")) {
        toast.error("Microphone access denied — check browser settings.");
      }
    },

    onDisconnect: () => {
      // Auto-reconnect on unexpected disconnect
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
      const token = await fetchToken();
      await scribe.connect({ token });
    } catch (err) {
      const msg = (err as Error).message || "Failed to start voice input";
      if (msg.includes("NotAllowedError") || msg.includes("Permission denied")) {
        toast.error("Microphone access denied — check browser settings.");
      }
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
    setFinalTranscript("");
    setDisplayTranscript("");
    scribe.clearTranscripts();
  }, [scribe]);

  // Map SDK status to isListening/isConnecting
  const isListening = scribe.isConnected || scribe.isTranscribing;
  const isConnecting = scribe.status === "connecting";

  return {
    isSupported,
    isListening,
    isConnecting,
    transcript: displayTranscript,
    finalTranscript,
    startListening,
    stopListening,
    resetTranscript,
    error: scribe.error,
    status: scribe.status,
  };
}
