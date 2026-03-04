"use client";

/**
 * Voice input hook — SDK-based wrapper around ElevenLabs `useScribe`.
 *
 * CRITICAL for iOS Safari: startListening() MUST be called from a user
 * gesture handler (click/tap). The bridge's startVoiceMode() ensures this.
 * getUserMedia is called first to trigger the permission prompt, then
 * Scribe.connect() is called immediately after (within the same async chain).
 * iOS Safari's transient activation window (~5s) allows this.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useScribe, type ScribeStatus } from "@elevenlabs/react";
import { toast } from "sonner";

export interface UseVoiceClientReturn {
  isSupported: boolean;
  isListening: boolean;
  isConnecting: boolean;
  transcript: string;
  finalTranscript: string;
  startListening: () => Promise<void>;
  stopListening: () => void;
  resetTranscript: () => void;
  /** Force-commit current partial transcript (bypasses VAD silence detection) */
  forceCommit: () => void;
  error: string | null;
  status: ScribeStatus;
}

const MAX_RECONNECT_ATTEMPTS = 5;
const BASE_RECONNECT_DELAY_MS = 1000;
const SCRIBE_MODEL_ID = "scribe_v2_realtime";

const log = (msg: string, ...args: unknown[]) => console.log(`[VoiceClient] ${msg}`, ...args);
const logError = (msg: string, ...args: unknown[]) => console.error(`[VoiceClient] ${msg}`, ...args);

function checkSupport(): boolean {
  if (typeof window === "undefined") return false;
  return !!(typeof navigator.mediaDevices?.getUserMedia === "function" && typeof WebSocket !== "undefined");
}

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

interface TranscriptState {
  committed: string;
  partial: string;
}

export function useVoiceClient(): UseVoiceClientReturn {
  const [transcripts, setTranscripts] = useState<TranscriptState>({ committed: "", partial: "" });
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
      log("SESSION_STARTED — Scribe connection fully established");
      reconnectAttemptsRef.current = 0;
    },

    onPartialTranscript: (data) => {
      setTranscripts((prev) => ({ ...prev, partial: data.text }));
    },

    onCommittedTranscript: (data) => {
      log("Committed transcript:", data.text.substring(0, 50));
      // Skip empty commits (ambient noise / silence)
      if (!data.text.trim()) return;
      setTranscripts((prev) => ({
        committed: prev.committed ? `${prev.committed} ${data.text}` : data.text,
        partial: "",
      }));
      reconnectAttemptsRef.current = 0;
    },

    onAuthError: () => {
      logError("Auth error");
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
      } catch { /* Will trigger onDisconnect */ }
    }, delay);
  }, [scribe]);

  // Cleanup on unmount only — scribe object changes every render, so we use a ref
  const scribeRef = useRef(scribe);
  useEffect(() => { scribeRef.current = scribe; });
  useEffect(() => {
    return () => {
      intentionalDisconnectRef.current = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      scribeRef.current.disconnect();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Start listening. MUST be called from a user gesture handler chain
   * (click/tap → bridge.startVoiceMode → this function).
   *
   * Flow:
   * 1. getUserMedia() — triggers iOS Safari permission prompt (within gesture)
   * 2. fetchToken() — gets ElevenLabs token (fast, stays within ~5s activation)
   * 3. scribe.connect() — Scribe.connect() internally calls getUserMedia again,
   *    but since permission was just granted in step 1, it succeeds
   *
   * The key: steps 1-3 happen in the SAME async chain starting from the
   * user's click. iOS Safari's transient activation window allows all of this.
   */
  const startListening = useCallback(async () => {
    log("startListening called, status:", scribe.status, "isConnected:", scribe.isConnected);
    if (scribe.isConnected || scribe.status === "connecting") {
      log("Already connected/connecting, skipping");
      return;
    }

    intentionalDisconnectRef.current = false;
    reconnectAttemptsRef.current = 0;

    // Step 1: getUserMedia — triggers permission prompt on iOS Safari
    // This MUST happen in the user gesture chain
    log("Step 1: Requesting microphone permission...");
    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      log("Step 1: Mic permission GRANTED, tracks:", micStream.getTracks().length);
      // DON'T stop the stream yet — keep it alive so Scribe's internal getUserMedia succeeds
    } catch (err) {
      const msg = (err as Error).message || "";
      logError("Step 1: Mic permission DENIED:", msg);
      throw err; // Re-throw so bridge shows error state
    }

    try {
      // Step 2: Fetch token (fast — should complete within activation window)
      const token = await fetchToken();

      // Step 3: Connect Scribe — its internal getUserMedia should succeed
      // because we just got permission and the stream is still alive
      log("Step 3: Connecting Scribe...");
      const connectPromise = scribe.connect({ token });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Connection timeout")), 15000),
      );
      await Promise.race([connectPromise, timeoutPromise]);
      log("Step 3: Scribe.connect() resolved");
    } catch (err) {
      const msg = (err as Error).message || "Failed to start voice input";
      logError("startListening failed:", msg);
      if (msg.includes("timeout") || msg.includes("Timeout")) {
        toast.error("Voice connection timed out.");
      } else if (!msg.includes("NotAllowedError") && !msg.includes("Permission denied")) {
        toast.error("Voice connection failed — please try again.");
      }
      try { scribe.disconnect(); } catch { /* ignore */ }
      throw err;
    } finally {
      // Release our pre-acquired stream now that Scribe has its own
      if (micStream) {
        micStream.getTracks().forEach((t) => t.stop());
        log("Pre-acquired mic stream released");
      }
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

  /**
   * Force-commit current partial transcript — bypasses VAD silence detection.
   * Use when VAD fails to detect silence (noisy environment, mobile mic, etc.)
   */
  const forceCommit = useCallback(() => {
    if (!scribe.isConnected && !scribe.isTranscribing) {
      log("forceCommit: not connected, ignoring");
      return;
    }
    log("forceCommit: manually committing current partial transcript");
    try {
      scribe.commit();
    } catch (err) {
      logError("forceCommit failed:", (err as Error).message);
    }
  }, [scribe]);

  // Auto-commit fallback: if partial transcript hasn't changed for 2.5s,
  // force a commit. This handles noisy environments where VAD can't detect silence.
  const autoCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPartialRef = useRef("");
  useEffect(() => {
    if (autoCommitTimerRef.current) {
      clearTimeout(autoCommitTimerRef.current);
      autoCommitTimerRef.current = null;
    }

    // Only auto-commit if we have partial text and are actively listening
    if (!transcripts.partial || (!scribe.isConnected && !scribe.isTranscribing)) {
      lastPartialRef.current = "";
      return;
    }

    // If partial text changed, restart the timer
    if (transcripts.partial !== lastPartialRef.current) {
      lastPartialRef.current = transcripts.partial;
      autoCommitTimerRef.current = setTimeout(() => {
        // If partial text is still the same after 2.5s, force commit
        log("Auto-commit: partial transcript unchanged for 2.5s, forcing commit");
        try {
          scribe.commit();
        } catch (err) {
          logError("Auto-commit failed:", (err as Error).message);
        }
      }, 2500);
    }

    return () => {
      if (autoCommitTimerRef.current) {
        clearTimeout(autoCommitTimerRef.current);
        autoCommitTimerRef.current = null;
      }
    };
  }, [transcripts.partial, scribe]);

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
    forceCommit,
    error: scribe.error,
    status: scribe.status,
  };
}
