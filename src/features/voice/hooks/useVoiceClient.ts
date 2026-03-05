"use client";

/**
 * Voice input hook — captures audio via MediaRecorder, transcribes via
 * server-side ElevenLabs Scribe REST API.
 *
 * Architecture: Browser captures raw audio → POST /api/voice/transcribe →
 * server calls ElevenLabs STT → returns transcript. Zero browser-specific
 * SDK dependencies. Works reliably on iOS Safari, Chrome, Firefox.
 *
 * Silence detection: simple energy-based VAD. When silence exceeds threshold,
 * recording stops and audio is sent for transcription.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceClientStatus =
  | "idle"
  | "requesting-mic"
  | "listening"
  | "transcribing"
  | "error";

export interface UseVoiceClientReturn {
  isSupported: boolean;
  isListening: boolean;
  isConnecting: boolean;
  transcript: string;
  finalTranscript: string;
  startListening: () => Promise<void>;
  stopListening: () => void;
  resetTranscript: () => void;
  /** Force-commit current recording (stop + transcribe immediately) */
  forceCommit: () => void;
  /** Pause recording (stop MediaRecorder but keep mic stream alive) */
  pauseRecording: () => void;
  /** Resume recording after pause (reuses existing mic stream) */
  resumeRecording: () => void;
  error: string | null;
  status: VoiceClientStatus;
}

// VAD constants
const SILENCE_THRESHOLD = 0.01; // RMS energy threshold for "silence"
const SILENCE_DURATION_MS = 1500; // ms of silence before auto-stop
const MIN_RECORDING_MS = 500; // minimum recording duration
const MAX_RECORDING_MS = 60_000; // maximum recording duration (1 min)
const ANALYSER_FFT_SIZE = 512;

const log = (msg: string, ...args: unknown[]) =>
  console.log(`[VoiceClient] ${msg}`, ...args);
const logError = (msg: string, ...args: unknown[]) =>
  console.error(`[VoiceClient] ${msg}`, ...args);

function checkSupport(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined"
  );
}

/** Pick the best supported MIME type for MediaRecorder */
function getPreferredMimeType(): string {
  // Prefer webm (Chrome/Firefox), fall back to mp4 (Safari)
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "",
  ];
  for (const mime of candidates) {
    if (!mime || MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return ""; // browser default
}

async function transcribeAudio(blob: Blob): Promise<string> {
  log("Transcribing", blob.size, "bytes, type:", blob.type);
  const form = new FormData();
  // Determine file extension from MIME type
  const ext = blob.type.includes("mp4")
    ? "mp4"
    : blob.type.includes("ogg")
      ? "ogg"
      : "webm";
  form.append("audio", blob, `recording.${ext}`);

  const res = await fetch("/api/voice/transcribe", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(
      (errBody as { error?: string }).error || `Transcription failed: ${res.status}`,
    );
  }

  const data = (await res.json()) as { transcript: string; language?: string };
  return data.transcript;
}

export function useVoiceClient(): UseVoiceClientReturn {
  const [status, setStatus] = useState<VoiceClientStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isSupported = checkSupport();

  // Refs for recording state
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const recordStartRef = useRef<number>(0);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStoppingRef = useRef(false);
  // Track whether we're actively in a voice mode session (between startListening and explicit close)
  const sessionActiveRef = useRef(false);
  // Ref for startRecordingInternal to break circular dependency with processRecording
  const startRecordingRef = useRef<() => void>(() => {});

  /** Clean up all audio resources */
  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  /** Process recorded audio — stop, collect blob, transcribe */
  const processRecording = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      isStoppingRef.current = false;
      return;
    }

    // Cancel VAD monitoring
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }

    // Stop recorder and collect blob
    const blob = await new Promise<Blob>((resolve) => {
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        resolve(new Blob(chunksRef.current, { type: mimeType }));
        chunksRef.current = [];
      };
      recorder.stop();
    });

    // Close audio context (no longer need analyser)
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;

    // Don't release mic stream yet — keep it for continuous mode
    // It will be released in stopListening()

    if (blob.size < 1000) {
      log("Recording too short/small, skipping transcription");
      isStoppingRef.current = false;
      // Restart recording if session is still active — no status flicker
      if (sessionActiveRef.current) {
        setStatus("listening");
        startRecordingRef.current();
      } else {
        setStatus("idle");
      }
      return;
    }

    // Blob is valid — now show transcribing state
    setStatus("transcribing");
    // Don't set transcript to "Transcribing..." — the voice mode bridge handles
    // visual state without this text, and displaying it in the overlay is confusing.

    try {
      const text = await transcribeAudio(blob);
      log("Transcript:", text.substring(0, 80));

      if (text.trim()) {
        setTranscript(text);
        setFinalTranscript(text);
      } else {
        log("Empty transcript, continuing to listen");
        setTranscript("");
      }
    } catch (err) {
      const msg = (err as Error).message || "Transcription failed";
      logError("Transcription error:", msg);
      setError(msg);
    }

    isStoppingRef.current = false;

    // Restart recording for continuous conversation if session is active
    if (sessionActiveRef.current) {
      setStatus("listening");
      startRecordingRef.current();
    } else {
      setStatus("idle");
    }
  }, []);

  /** Internal: start a new recording segment (mic stream already acquired) */
  const startRecordingInternal = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (!stream) {
      logError("startRecordingInternal: no media stream");
      return;
    }

    isStoppingRef.current = false;
    chunksRef.current = [];
    silenceStartRef.current = null;
    recordStartRef.current = Date.now();

    const mimeType = getPreferredMimeType();
    log("Starting MediaRecorder, mimeType:", mimeType || "(default)");

    const recorder = new MediaRecorder(stream, {
      mimeType: mimeType || undefined,
      audioBitsPerSecond: 64000,
    });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    // Collect data every 250ms for progressive chunking
    recorder.start(250);

    // Set up audio analysis for VAD
    try {
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = ANALYSER_FFT_SIZE;
      source.connect(analyser);
      analyserRef.current = analyser;

      // Start VAD monitoring loop
      const buffer = new Float32Array(analyser.fftSize);
      const checkVAD = () => {
        if (!analyserRef.current || isStoppingRef.current) return;

        analyserRef.current.getFloatTimeDomainData(buffer);

        // Calculate RMS energy
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i] * buffer[i];
        }
        const rms = Math.sqrt(sum / buffer.length);

        const now = Date.now();
        const elapsed = now - recordStartRef.current;

        if (rms < SILENCE_THRESHOLD) {
          // Silence detected
          if (!silenceStartRef.current) {
            silenceStartRef.current = now;
          }
          const silenceDuration = now - silenceStartRef.current;
          if (silenceDuration >= SILENCE_DURATION_MS && elapsed >= MIN_RECORDING_MS) {
            log(`VAD: ${silenceDuration}ms silence, stopping recording`);
            void processRecording();
            return;
          }
        } else {
          // Speech detected — reset silence timer
          silenceStartRef.current = null;
        }

        rafRef.current = requestAnimationFrame(checkVAD);
      };

      rafRef.current = requestAnimationFrame(checkVAD);
    } catch (err) {
      logError("AudioContext/Analyser setup failed:", (err as Error).message);
      // Continue without VAD — user will have to manually stop
    }

    // Safety: max recording duration
    maxTimerRef.current = setTimeout(() => {
      log("Max recording duration reached");
      void processRecording();
    }, MAX_RECORDING_MS);
  }, [processRecording]);

  // Keep ref in sync so processRecording can call it without circular deps
  useEffect(() => {
    startRecordingRef.current = startRecordingInternal;
  });

  /**
   * Start listening. MUST be called from a user gesture handler chain
   * (click/tap) for iOS Safari mic permission.
   */
  const startListening = useCallback(async () => {
    log("startListening called");
    if (status === "listening" || status === "requesting-mic") {
      log("Already listening/requesting, skipping");
      return;
    }

    setError(null);
    setStatus("requesting-mic");
    sessionActiveRef.current = true;

    try {
      // Request microphone — must happen in user gesture chain for iOS
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      log("Mic permission granted, tracks:", stream.getTracks().length);
      mediaStreamRef.current = stream;

      setStatus("listening");
      startRecordingInternal();
    } catch (err) {
      const msg = (err as Error).message || "Microphone access denied";
      logError("getUserMedia failed:", msg);
      setError(msg);
      setStatus("error");
      sessionActiveRef.current = false;
      throw err; // Re-throw so bridge can handle UI state
    }
  }, [status, startRecordingInternal]);

  /** Stop listening completely — end session, release mic */
  const stopListening = useCallback(() => {
    log("stopListening called");
    sessionActiveRef.current = false;
    isStoppingRef.current = false;
    cleanup();
    setStatus("idle");
  }, [cleanup]);

  /**
   * Pause recording — stops MediaRecorder and VAD but keeps the mic stream
   * alive. Used during TTS playback to prevent feedback loops.
   * Session remains active; call resumeRecording() to restart.
   */
  const pauseRecording = useCallback(() => {
    log("pauseRecording called");
    // Stop VAD monitoring
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }
    // Stop recorder but keep mic stream alive
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    // Close audio context (analyser)
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    isStoppingRef.current = false;
    // Don't change sessionActiveRef — session is still conceptually alive
    // Don't release mediaStreamRef — we'll reuse it
  }, []);

  /**
   * Resume recording after a pause — starts a new recording segment
   * using the existing mic stream. Only works if mic stream is still alive.
   */
  const resumeRecording = useCallback(() => {
    log("resumeRecording called");
    if (!mediaStreamRef.current) {
      logError("resumeRecording: no mic stream — call startListening instead");
      return;
    }
    if (!sessionActiveRef.current) {
      log("resumeRecording: session not active, skipping");
      return;
    }
    startRecordingInternal();
    setStatus("listening");
  }, [startRecordingInternal]);

  /** Reset transcript state */
  const resetTranscript = useCallback(() => {
    setTranscript("");
    setFinalTranscript("");
  }, []);

  /** Force-commit: stop current recording and transcribe immediately */
  const forceCommit = useCallback(() => {
    log("forceCommit called");
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      void processRecording();
    }
  }, [processRecording]);

  const isListening = status === "listening";
  const isConnecting = status === "requesting-mic";

  return {
    isSupported,
    isListening,
    isConnecting,
    transcript,
    finalTranscript,
    startListening,
    stopListening,
    resetTranscript,
    forceCommit,
    pauseRecording,
    resumeRecording,
    error,
    status,
  };
}
