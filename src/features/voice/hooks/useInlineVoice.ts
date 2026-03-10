"use client";

/**
 * useInlineVoice — Inline voice mode for chat composer.
 *
 * No overlay, no separate screen. Voice happens in the chat:
 * 1. User taps mic → getUserMedia + MediaRecorder
 * 2. VAD detects silence → audio blob POST'd to /api/voice/transcribe
 * 3. Transcript sent to agent via onUserMessage callback (appears as normal chat message)
 * 4. Agent responds in chat thread as usual
 * 5. When response ready → TTS via /api/tts → HTMLAudioElement playback
 * 6. After TTS finishes → auto-restart recording for next turn
 *
 * Zero dependency on VoiceModeProvider or overlay state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceSettings } from "./useVoiceSettings";
import { createStudioSettingsCoordinator } from "@/lib/studio/coordinator";
import type { ResolvedVoiceSettings } from "../lib/voiceTypes";

// ── Types ────────────────────────────────────────────────────────────

export type InlineVoiceState =
  | "idle"
  | "requesting-mic"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

export interface UseInlineVoiceOptions {
  /** Called when user speech is transcribed — send it to the agent */
  onUserMessage?: (text: string) => void;
  /** Called whenever voice state changes */
  onStateChange?: (state: InlineVoiceState) => void;
  /** Agent ID for voice settings lookup */
  agentId?: string | null;
}

export interface UseInlineVoiceReturn {
  /** Start voice mode — MUST be called from user gesture */
  start: () => Promise<void>;
  /** Stop voice mode entirely — releases mic, stops TTS */
  stop: () => void;
  /** Call when agent response is ready to speak */
  speakResponse: (text: string) => Promise<void>;
  /** Force-commit current recording (tap-to-send) */
  forceCommit: () => void;
  /** Current state */
  state: InlineVoiceState;
  /** Whether voice mode is active (any state except idle) */
  isActive: boolean;
  /** Whether currently recording */
  isListening: boolean;
  /** Whether TTS is playing */
  isSpeaking: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────

const SILENCE_THRESHOLD = 0.01;
const SILENCE_DURATION_MS = 1500;
const MIN_RECORDING_MS = 500;
const MAX_RECORDING_MS = 60_000;
const ANALYSER_FFT_SIZE = 512;

const log = (msg: string, ...args: unknown[]) =>
  console.log(`[InlineVoice] ${msg}`, ...args);

// ── Helpers ───────────────────────────────────────────────────────────

function getPreferredMimeType(): string {
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
  return "";
}

async function transcribeAudio(blob: Blob): Promise<string> {
  log("Transcribing", blob.size, "bytes");
  const form = new FormData();
  const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm";
  form.append("audio", blob, `recording.${ext}`);

  const res = await fetch("/api/voice/transcribe", { method: "POST", body: form });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error((errBody as { error?: string }).error || `Transcription failed: ${res.status}`);
  }

  const data = (await res.json()) as { transcript: string };
  return data.transcript;
}

function speakOptsFromSettings(s: ResolvedVoiceSettings) {
  return {
    voiceId: s.voiceId,
    modelId: s.modelId,
    voiceSettings: {
      stability: s.voiceConfig.stability,
      similarity_boost: s.voiceConfig.similarityBoost,
      style: s.voiceConfig.style,
      use_speaker_boost: s.voiceConfig.useSpeakerBoost,
    },
  };
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useInlineVoice(options?: UseInlineVoiceOptions): UseInlineVoiceReturn {
  const [state, setState] = useState<InlineVoiceState>("idle");

  // Refs for callback stability
  const onUserMessageRef = useRef(options?.onUserMessage);
  const onStateChangeRef = useRef(options?.onStateChange);
  useEffect(() => { onUserMessageRef.current = options?.onUserMessage; }, [options?.onUserMessage]);
  useEffect(() => { onStateChangeRef.current = options?.onStateChange; }, [options?.onStateChange]);

  // Settings
  const [coordinator] = useState(() => createStudioSettingsCoordinator({ debounceMs: 200 }));
  const voiceSettings = useVoiceSettings({
    settingsCoordinator: coordinator,
    agentId: options?.agentId,
  });
  const settingsRef = useRef(voiceSettings.settings);
  useEffect(() => { settingsRef.current = voiceSettings.settings; }, [voiceSettings.settings]);

  // Recording refs
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
  const sessionActiveRef = useRef(false);

  // TTS refs
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const warmedRef = useRef(false);

  // For start recording ref to break circular dependency
  const startRecordingRef = useRef<() => void>(() => {});

  // State change helper
  const updateState = useCallback((newState: InlineVoiceState) => {
    setState(newState);
    onStateChangeRef.current?.(newState);
  }, []);

  // ── TTS helpers ────────────────────────────────────────────────────

  const cleanupTts = useCallback(() => {
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.removeAttribute("src");
      audioElRef.current.load();
      audioElRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const stopTts = useCallback(() => {
    ttsAbortRef.current?.abort();
    ttsAbortRef.current = null;
    cleanupTts();
  }, [cleanupTts]);

  const warmupAudio = useCallback(() => {
    if (warmedRef.current) return;
    try {
      const audio = new Audio(
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA",
      );
      audio.play().catch(() => {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
      });
      warmedRef.current = true;
      log("Audio playback unlocked");
    } catch (err) {
      console.warn("[InlineVoice] Warmup failed:", err);
    }
  }, []);

  // ── Recording helpers ──────────────────────────────────────────────

  const cleanupRecording = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try { recorderRef.current.stop(); } catch { /* ignore */ }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;
  }, []);

  const releaseMic = useCallback(() => {
    cleanupRecording();
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
  }, [cleanupRecording]);

  /** Process recorded audio — stop recorder, collect blob, transcribe, send */
  const processRecording = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;

    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      isStoppingRef.current = false;
      return;
    }

    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }

    const blob = await new Promise<Blob>((resolve) => {
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        resolve(new Blob(chunksRef.current, { type: mimeType }));
        chunksRef.current = [];
      };
      recorder.stop();
    });

    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;

    if (blob.size < 1000) {
      log("Recording too short, skipping");
      isStoppingRef.current = false;
      if (sessionActiveRef.current) {
        updateState("listening");
        startRecordingRef.current();
      } else {
        updateState("idle");
      }
      return;
    }

    updateState("transcribing");

    try {
      const text = await transcribeAudio(blob);
      log("Transcript:", text.substring(0, 80));

      if (text.trim() && onUserMessageRef.current) {
        updateState("thinking");
        log("Sending to agent");
        onUserMessageRef.current(text);
      } else {
        log("Empty transcript, continuing");
        if (sessionActiveRef.current) {
          updateState("listening");
          startRecordingRef.current();
        }
      }
    } catch (err) {
      console.error("[InlineVoice] Transcription error:", (err as Error).message);
      if (sessionActiveRef.current) {
        updateState("listening");
        startRecordingRef.current();
      }
    }

    isStoppingRef.current = false;
  }, [updateState]);

  /** Start a new recording segment (mic already acquired) */
  const startRecordingInternal = useCallback(() => {
    const stream = mediaStreamRef.current;
    if (!stream) { log("No mic stream"); return; }

    isStoppingRef.current = false;
    chunksRef.current = [];
    silenceStartRef.current = null;
    recordStartRef.current = Date.now();

    const mimeType = getPreferredMimeType();
    const recorder = new MediaRecorder(stream, {
      mimeType: mimeType || undefined,
      audioBitsPerSecond: 64000,
    });
    recorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onerror = (e) => {
      console.error("[InlineVoice] MediaRecorder error:", e);
      updateState("error");
    };
    recorder.start(250);

    try {
      const audioCtx = new AudioContext();
      audioContextRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = ANALYSER_FFT_SIZE;
      source.connect(analyser);
      analyserRef.current = analyser;

      const buffer = new Float32Array(analyser.fftSize);
      const checkVAD = () => {
        if (!analyserRef.current || isStoppingRef.current) return;
        analyserRef.current.getFloatTimeDomainData(buffer);

        let sum = 0;
        for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
        const rms = Math.sqrt(sum / buffer.length);
        const now = Date.now();
        const elapsed = now - recordStartRef.current;

        if (rms < SILENCE_THRESHOLD) {
          if (!silenceStartRef.current) silenceStartRef.current = now;
          if (now - silenceStartRef.current >= SILENCE_DURATION_MS && elapsed >= MIN_RECORDING_MS) {
            log(`VAD: ${now - silenceStartRef.current}ms silence, stopping`);
            void processRecording();
            return;
          }
        } else {
          silenceStartRef.current = null;
        }

        rafRef.current = requestAnimationFrame(checkVAD);
      };
      rafRef.current = requestAnimationFrame(checkVAD);
    } catch (err) {
      console.error("[InlineVoice] VAD setup failed:", (err as Error).message);
    }

    maxTimerRef.current = setTimeout(() => {
      log("Max recording duration");
      void processRecording();
    }, MAX_RECORDING_MS);
  }, [processRecording]);

  useEffect(() => { startRecordingRef.current = startRecordingInternal; });

  // ── Public API ─────────────────────────────────────────────────────

  const start = useCallback(async () => {
    log("Starting inline voice mode");
    warmupAudio();
    updateState("requesting-mic");
    sessionActiveRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      log("Mic granted");
      mediaStreamRef.current = stream;
      updateState("listening");
      startRecordingInternal();
    } catch (err) {
      const msg = (err as Error).message || "";
      console.error("[InlineVoice] Mic failed:", msg);
      sessionActiveRef.current = false;
      updateState("error");
    }
  }, [warmupAudio, updateState, startRecordingInternal]);

  const stop = useCallback(() => {
    log("Stopping inline voice mode");
    sessionActiveRef.current = false;
    releaseMic();
    stopTts();
    updateState("idle");
  }, [releaseMic, stopTts, updateState]);

  const speakResponse = useCallback(async (text: string) => {
    log("speakResponse, text length:", text.length);
    if (!sessionActiveRef.current || !text.trim()) {
      log("speakResponse skipped — not active or empty text");
      // Even if not active, transition back to idle if we were thinking
      if (state === "thinking") updateState("idle");
      return;
    }

    updateState("speaking");
    cleanupRecording();

    const controller = new AbortController();
    ttsAbortRef.current = controller;
    const opts = speakOptsFromSettings(settingsRef.current);

    try {
      log("Fetching /api/tts, voiceId:", opts.voiceId);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, ...opts }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: "TTS failed" }));
        throw new Error((errBody as { error?: string }).error || `TTS failed: ${res.status}`);
      }

      const blob = await res.blob();
      log("TTS blob:", blob.size, "bytes");
      if (controller.signal.aborted) return;

      const blobUrl = URL.createObjectURL(blob);
      blobUrlRef.current = blobUrl;
      const audio = new Audio(blobUrl);
      audioElRef.current = audio;

      await new Promise<void>((resolve, reject) => {
        audio.onplay = () => log("TTS playback started");
        audio.onended = () => {
          log("TTS playback ended");
          cleanupTts();
          resolve();
        };
        audio.onerror = () => {
          cleanupTts();
          reject(new Error("Audio playback failed"));
        };
        audio.play().catch(reject);
      });

      log("TTS complete");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("[InlineVoice] TTS error:", (err as Error).message);
    }

    // Resume listening if still active
    if (sessionActiveRef.current) {
      updateState("listening");
      startRecordingRef.current();
      log("Resumed listening");
    }
  }, [state, updateState, cleanupRecording, cleanupTts]);

  const forceCommit = useCallback(() => {
    log("forceCommit");
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      void processRecording();
    }
  }, [processRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      sessionActiveRef.current = false;
      releaseMic();
      stopTts();
    };
  }, [releaseMic, stopTts]);

  return {
    start,
    stop,
    speakResponse,
    forceCommit,
    state,
    isActive: state !== "idle",
    isListening: state === "listening",
    isSpeaking: state === "speaking",
  };
}
