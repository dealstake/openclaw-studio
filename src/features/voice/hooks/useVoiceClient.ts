"use client";

/**
 * Voice input hook — SDK-based wrapper around ElevenLabs `useScribe`.
 *
 * Features:
 * - Pre-acquires mic permission before Scribe connection (iOS Safari safety net)
 * - Automatic microphone management via SDK
 * - Consolidated transcript state to prevent stale closure bugs
 * - Auto-reconnect with exponential backoff (max 3 attempts)
 * - Comprehensive logging for debugging voice mode issues
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useScribe, type ScribeStatus } from "@/hooks/use-scribe";
import { toast } from "sonner";

// ── Types ───────────────────────────────────────────────────────────────

export interface UseVoiceClientReturn {
  isSupported: boolean;
  isListening: boolean;
  isConnecting: boolean;
  transcript: string;
  finalTranscript: string;
  startListening: () => Promise<void>;
  stopListening: () => void;
  resetTranscript: () => void;
  error: string | null;
  status: ScribeStatus;
}

// ── Constants ───────────────────────────────────────────────────────────

const MAX_RECONNECT_ATTEMPTS = 3;
const BASE_RECONNECT_DELAY_MS = 1000;
const SCRIBE_MODEL_ID = "scribe_v2_realtime";

const log = (msg: string, ...args: unknown[]) => console.log(`[VoiceClient] ${msg}`, ...args);
const logError = (msg: string, ...args: unknown[]) => console.error(`[VoiceClient] ${msg}`, ...args);

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
  log("Fetching STT token...");
  const res = await fetch("/api/voice/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "realtime_scribe" }),
  });

  log("Token response:", res.status, res.statusText);

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `Failed: ${res.status}` }));
    throw new Error((errBody as { error?: string }).error || `Failed to get voice token: ${res.status}`);
  }

  const data = (await res.json()) as { token: string };
  log("Token received, length:", data.token?.length);
  return data.token;
}

// ── Hook ────────────────────────────────────────────────────────────────

interface TranscriptState {
  committed: string;
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

    onSessionStarted: () => {
      log("SESSION_STARTED — Scribe connection established");
    },

    onPartialTranscript: (data) => {
      log("Partial transcript:", data.text.substring(0, 50));
      setTranscripts((prev) => ({
        ...prev,
        partial: data.text,
      }));
    },

    onCommittedTranscript: (data) => {
      log("Committed transcript:", data.text.substring(0, 50));
      setTranscripts((prev) => ({
        committed: prev.committed ? `${prev.committed} ${data.text}` : data.text,
        partial: "",
      }));
      reconnectAttemptsRef.current = 0;
    },

    onAuthError: () => {
      logError("Auth error from Scribe");
      attemptReconnect();
    },

    onQuotaExceededError: () => {
      logError("Quota exceeded");
      toast.error("Voice quota reached. Try again later.");
    },

    onRateLimitedError: () => {
      logError("Rate limited");
      toast.error("Too many requests. Please wait.");
    },

    onError: (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      logError("STT error:", msg);
      if (!(msg.includes("NotAllowedError") || msg.includes("Permission denied"))) {
        // Don't toast mic permission — parent handles
      }
    },

    onDisconnect: () => {
      log("Scribe disconnected, intentional:", intentionalDisconnectRef.current);
      if (!intentionalDisconnectRef.current) {
        attemptReconnect();
      }
    },
  });

  const attemptReconnect = useCallback(() => {
    if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
      logError("Max reconnect attempts reached");
      toast.error("Voice unavailable — please try again.");
      return;
    }

    const delay = BASE_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current);
    reconnectAttemptsRef.current++;
    log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);

    reconnectTimerRef.current = setTimeout(async () => {
      try {
        const token = await fetchToken();
        await scribe.connect({ token });
      } catch {
        // Will trigger onDisconnect → another attemptReconnect
      }
    }, delay);
  }, [scribe]);

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
    log("startListening called, status:", scribe.status, "isConnected:", scribe.isConnected);
    
    if (scribe.isConnected || scribe.status === "connecting") {
      log("Already connected/connecting, skipping");
      return;
    }

    intentionalDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;

    try {
      // Pre-acquire mic permission as safety net.
      // The primary mic acquisition should happen in the VoiceModeButton click handler.
      // This is a fallback for desktop/keyboard shortcut scenarios.
      log("Pre-acquiring mic permission (safety net)...");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        });
        stream.getTracks().forEach((track) => track.stop());
        log("Mic permission pre-acquired (safety net)");
      } catch (micErr) {
        logError("Mic permission pre-acquire failed (may already be granted from click handler):", micErr);
        // Don't throw — the click handler may have already acquired permission
      }

      const token = await fetchToken();
      
      log("Connecting Scribe with token...");
      const connectPromise = scribe.connect({ token });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout — microphone may be blocked")), 15000),
      );
      await Promise.race([connectPromise, timeoutPromise]);
      log("Scribe.connect() resolved");
    } catch (err) {
      const msg = (err as Error).message || "Failed to start voice input";
      logError("startListening failed:", msg);
      
      if (msg.includes("NotAllowedError") || msg.includes("Permission denied")) {
        // Parent shows MicPermissionDialog
      } else if (msg.includes("timeout") || msg.includes("Timeout")) {
        toast.error("Voice connection timed out — check microphone permissions.");
      } else {
        toast.error("Voice connection failed — please try again.");
      }
      try { scribe.disconnect(); } catch { /* ignore */ }
      throw err;
    }
  }, [scribe]);

  const stopListening = useCallback(() => {
    log("stopListening called");
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
