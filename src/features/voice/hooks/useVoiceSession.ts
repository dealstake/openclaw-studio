"use client";

/**
 * useVoiceSession — Unified voice mode hook.
 *
 * Consolidates useVoiceClient + useVoiceOutput + useVoiceModeBridge into a
 * single state machine with atomic transitions. No manual state sync needed.
 *
 * Architecture (server-side STT):
 * 1. User taps mic → getUserMedia + MediaRecorder
 * 2. VAD detects silence → audio blob POST'd to /api/voice/transcribe
 * 3. Server calls ElevenLabs Scribe REST API → returns transcript
 * 4. Transcript sent to agent via onUserMessage (chat.send over existing WS)
 * 5. Agent response → TTS via /api/tts → HTMLAudioElement playback
 * 6. After TTS finishes → auto-restart recording for next turn
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceModeSafe } from "../providers/VoiceModeProvider";
import { useVoiceSettings } from "./useVoiceSettings";
import { createStudioSettingsCoordinator } from "@/lib/studio/coordinator";
import type { ResolvedVoiceSettings } from "../lib/voiceTypes";

// ── Types ────────────────────────────────────────────────────────────

export type SessionStatus =
  | "idle"
  | "requesting-mic"
  | "listening"
  | "transcribing"
  | "thinking"     // waiting for agent response
  | "speaking"     // TTS playing
  | "error";

export interface UseVoiceSessionOptions {
  /** Callback when user finishes speaking — send text to agent */
  onUserMessage?: (text: string) => void;
}

export interface UseVoiceSessionReturn {
  /** Start voice mode — MUST be called from user gesture */
  start: (agentId: string) => Promise<void>;
  /** Call when agent response is ready to speak */
  speakResponse: (text: string) => Promise<void>;
  /** Force-commit current recording */
  forceCommit: () => void;
  /** Whether recording is active */
  isListening: boolean;
  /** Whether TTS is playing */
  isSpeaking: boolean;
  /** Voice settings for current agent */
  voiceSettings: ReturnType<typeof useVoiceSettings>;
}

// ── Constants ─────────────────────────────────────────────────────────

const SILENCE_THRESHOLD = 0.01;
const SILENCE_DURATION_MS = 1500;
const MIN_RECORDING_MS = 500;
const MAX_RECORDING_MS = 60_000;
const ANALYSER_FFT_SIZE = 512;

const log = (msg: string, ...args: unknown[]) =>
  console.log(`[VoiceSession] ${msg}`, ...args);

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

/** Convert resolved voice settings to TTS request body fields */
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

export function useVoiceSession(options?: UseVoiceSessionOptions): UseVoiceSessionReturn {
  const voiceMode = useVoiceModeSafe();
  const [status, setStatus] = useState<SessionStatus>("idle");

  // Refs for callback stability
  const onUserMessageRef = useRef(options?.onUserMessage);
  useEffect(() => { onUserMessageRef.current = options?.onUserMessage; }, [options?.onUserMessage]);

  // Settings
  const [coordinator] = useState(() => createStudioSettingsCoordinator({ debounceMs: 200 }));
  const voiceSettings = useVoiceSettings({
    settingsCoordinator: coordinator,
    agentId: voiceMode?.activeAgentId,
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

  // Voice mode active tracking
  const voiceModeActive = !!(voiceMode?.isOverlayOpen || voiceMode?.isMinimized);
  const voiceModeActiveRef = useRef(voiceModeActive);
  useEffect(() => { voiceModeActiveRef.current = voiceModeActive; }, [voiceModeActive]);

  // For start recording ref to break circular dependency
  const startRecordingRef = useRef<() => void>(() => {});

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
      console.warn("[VoiceSession] Warmup failed:", err);
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

    // Cancel VAD
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (maxTimerRef.current) { clearTimeout(maxTimerRef.current); maxTimerRef.current = null; }

    // Stop recorder and collect blob
    const blob = await new Promise<Blob>((resolve) => {
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || "audio/webm";
        resolve(new Blob(chunksRef.current, { type: mimeType }));
        chunksRef.current = [];
      };
      recorder.stop();
    });

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;

    if (blob.size < 1000) {
      log("Recording too short, skipping");
      isStoppingRef.current = false;
      if (sessionActiveRef.current) {
        setStatus("listening");
        voiceMode?.setState("listening");
        startRecordingRef.current();
      } else {
        setStatus("idle");
      }
      return;
    }

    // Transcribe
    setStatus("transcribing");

    try {
      const text = await transcribeAudio(blob);
      log("Transcript:", text.substring(0, 80));

      if (text.trim() && onUserMessageRef.current) {
        // Update UI with user's transcript
        voiceMode?.setUserTranscript(text);
        voiceMode?.setState("thinking");
        setStatus("thinking");

        log("Sending to agent");
        onUserMessageRef.current(text);
      } else {
        log("Empty transcript, continuing");
        // Restart recording
        if (sessionActiveRef.current) {
          setStatus("listening");
          voiceMode?.setState("listening");
          startRecordingRef.current();
        }
      }
    } catch (err) {
      console.error("[VoiceSession] Transcription error:", (err as Error).message);
      // Keep going — restart recording
      if (sessionActiveRef.current) {
        setStatus("listening");
        voiceMode?.setState("listening");
        startRecordingRef.current();
      }
    }

    isStoppingRef.current = false;
  }, [voiceMode]);

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
    recorder.start(250);

    // Set up VAD
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

        // Update input volume for Orb visualization
        voiceMode?.setInputVolume(Math.min(rms * 10, 1));

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
      console.error("[VoiceSession] VAD setup failed:", (err as Error).message);
    }

    maxTimerRef.current = setTimeout(() => {
      log("Max recording duration");
      void processRecording();
    }, MAX_RECORDING_MS);
  }, [processRecording, voiceMode]);

  // Keep ref in sync
  useEffect(() => { startRecordingRef.current = startRecordingInternal; });

  // ── Public API ─────────────────────────────────────────────────────

  /**
   * Start voice mode — MUST be called from a user gesture.
   */
  const start = useCallback(async (agentId: string) => {
    if (!voiceMode) return;

    log("Starting voice mode from user gesture");
    voiceMode.openVoiceMode(agentId);
    warmupAudio();
    setStatus("requesting-mic");
    sessionActiveRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      log("Mic granted");
      mediaStreamRef.current = stream;

      setStatus("listening");
      voiceMode.setState("listening");
      startRecordingInternal();
    } catch (err) {
      const msg = (err as Error).message || "";
      console.error("[VoiceSession] Mic failed:", msg);
      sessionActiveRef.current = false;
      setStatus("error");

      if (msg.includes("NotAllowedError") || msg.includes("Permission denied") || msg.includes("not found")) {
        voiceMode.setState("idle");
        voiceMode.setLastError("mic-denied");
      } else if (msg.includes("API key") || msg.includes("401")) {
        voiceMode.setState("idle");
        voiceMode.setLastError("api-key-missing");
      } else {
        voiceMode.closeVoiceMode();
      }
    }
  }, [voiceMode, warmupAudio, startRecordingInternal]);

  /**
   * Speak agent response via TTS, then auto-restart recording.
   */
  const speakResponse = useCallback(async (text: string) => {
    log("speakResponse, text length:", text.length);
    if (!voiceMode || !voiceModeActiveRef.current || !text.trim()) {
      log("speakResponse skipped — not active or empty text");
      return;
    }

    voiceMode.setAgentTranscript(text);
    voiceMode.setState("speaking");
    setStatus("speaking");

    // Pause recording during TTS
    cleanupRecording();
    log("Mic paused for TTS");

    // Fetch and play TTS
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

      // Track output volume for Orb
      voiceMode.setOutputVolume(0.7);

      await new Promise<void>((resolve, reject) => {
        audio.onplay = () => log("TTS playback started");
        audio.onended = () => {
          log("TTS playback ended");
          voiceMode?.setOutputVolume(0);
          cleanupTts();
          resolve();
        };
        audio.onerror = () => {
          voiceMode?.setOutputVolume(0);
          cleanupTts();
          reject(new Error("Audio playback failed"));
        };
        audio.play().catch(reject);
      });

      log("TTS complete");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("[VoiceSession] TTS error:", (err as Error).message);
    }

    // Resume listening if still active
    if (voiceModeActiveRef.current && sessionActiveRef.current) {
      voiceMode.setState("listening");
      voiceMode.setAgentTranscript("");
      voiceMode.setUserTranscript("");
      setStatus("listening");
      startRecordingRef.current();
      log("Resumed listening");
    }
  }, [voiceMode, cleanupRecording, cleanupTts]);

  /** Force-commit current recording (tap-to-send) */
  const forceCommit = useCallback(() => {
    log("forceCommit");
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      void processRecording();
    }
  }, [processRecording]);

  // ── Cleanup on close ───────────────────────────────────────────────

  useEffect(() => {
    if (!voiceModeActive) {
      sessionActiveRef.current = false;
      releaseMic();
      stopTts();
      setStatus("idle");
    }
  }, [voiceModeActive, releaseMic, stopTts]);

  // Listen for force-commit events from overlay
  useEffect(() => {
    const handler = () => forceCommit();
    window.addEventListener("voicemode:forcecommit", handler);
    return () => window.removeEventListener("voicemode:forcecommit", handler);
  }, [forceCommit]);

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
    speakResponse,
    forceCommit,
    isListening: status === "listening",
    isSpeaking: status === "speaking",
    voiceSettings,
  };
}
