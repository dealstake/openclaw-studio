"use client";

/**
 * Voice output hook — plays AI responses as speech via ElevenLabs TTS.
 *
 * Uses Web Audio API (AudioContext) instead of HTMLAudioElement for reliable
 * iOS Safari playback. The AudioContext is created and resumed during a user
 * gesture (warmup), then stays unlocked for the page lifecycle.
 *
 * Reference: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
 * iOS fix pattern: https://gist.github.com/kus/3f01d60569eeadefe3a1
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { ResolvedVoiceSettings } from "../lib/voiceTypes";

/** Options passed to speak() — voice settings from the settings hierarchy */
export interface SpeakOptions {
  voiceId?: string;
  modelId?: string;
  voiceSettings?: {
    stability: number;
    similarity_boost: number;
    style: number;
    use_speaker_boost: boolean;
  };
}

export interface UseVoiceOutputReturn {
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Whether TTS is loading (fetching audio) */
  isLoading: boolean;
  /** Speak the given text, optionally with specific voice settings */
  speak: (text: string, options?: SpeakOptions) => Promise<void>;
  /** Stop current playback */
  stop: () => void;
  /** Last error */
  error: string | null;
  /** Whether voice output is enabled */
  enabled: boolean;
  /** Toggle voice output on/off */
  setEnabled: (enabled: boolean) => void;
  /** Pre-warm AudioContext for iOS Safari — MUST call during user gesture */
  warmup: () => void;
}

/** Helper: convert ResolvedVoiceSettings to SpeakOptions */
export function resolvedToSpeakOptions(resolved: ResolvedVoiceSettings): SpeakOptions {
  return {
    voiceId: resolved.voiceId,
    modelId: resolved.modelId,
    voiceSettings: {
      stability: resolved.voiceConfig.stability,
      similarity_boost: resolved.voiceConfig.similarityBoost,
      style: resolved.voiceConfig.style,
      use_speaker_boost: resolved.voiceConfig.useSpeakerBoost,
    },
  };
}

/**
 * Audio playback strategy:
 * - warmup() plays a silent audio element during user gesture to unlock iOS Safari
 * - speak() fetches TTS as a blob, creates a Blob URL, plays via HTMLAudioElement
 * - HTMLAudioElement with Blob URL starts playback as soon as enough data is buffered
 *   (much faster than AudioContext which requires full download + decode first)
 */

export function useVoiceOutput(): UseVoiceOutputReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const warmedRef = useRef(false);

  const cleanupAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load(); // Release resources
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    cleanupAudio();
    setIsPlaying(false);
    setIsLoading(false);
  }, [cleanupAudio]);

  // Cleanup on unmount
  useEffect(() => {
    return stop;
  }, [stop]);

  const speak = useCallback(
    async (text: string, speakOpts?: SpeakOptions) => {
      console.log("[VoiceOutput] speak called, text length:", text.length, "voiceId:", speakOpts?.voiceId);
      if (!text.trim()) return;

      // Stop any current playback
      stop();

      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        console.log("[VoiceOutput] Fetching /api/tts...");
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            ...(speakOpts?.voiceId ? { voiceId: speakOpts.voiceId } : {}),
            ...(speakOpts?.modelId ? { modelId: speakOpts.modelId } : {}),
            ...(speakOpts?.voiceSettings ? { voiceSettings: speakOpts.voiceSettings } : {}),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: "TTS failed" }));
          throw new Error((errBody as { error?: string }).error || `TTS failed: ${res.status}`);
        }

        // Create Blob URL from response — HTMLAudioElement can start playing
        // as soon as enough data is buffered (no need to wait for full download)
        const blob = await res.blob();
        console.log("[VoiceOutput] TTS response OK, blob size:", blob.size);

        if (controller.signal.aborted) return;

        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;

        const audio = new Audio(blobUrl);
        audioRef.current = audio;

        // Set up event handlers before triggering play
        const playPromise = new Promise<void>((resolve, reject) => {
          audio.onplay = () => {
            setIsLoading(false);
            setIsPlaying(true);
            console.log("[VoiceOutput] Playback started");
          };

          audio.onended = () => {
            console.log("[VoiceOutput] Playback ended");
            setIsPlaying(false);
            cleanupAudio();
            resolve();
          };

          audio.onerror = () => {
            const msg = "Audio playback failed";
            console.error("[VoiceOutput]", msg);
            setError(msg);
            setIsPlaying(false);
            setIsLoading(false);
            cleanupAudio();
            reject(new Error(msg));
          };
        });

        // Start playback — works on iOS Safari because warmup() already
        // unlocked audio during the user gesture
        await audio.play();
        await playPromise;
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("[VoiceOutput] Error:", err);
        setError((err as Error).message || "TTS failed");
        setIsLoading(false);
        setIsPlaying(false);
      }
    },
    [stop, cleanupAudio],
  );

  /**
   * Pre-warm audio playback during a user gesture (clicking "Open voice mode").
   * CRITICAL for iOS Safari — plays a tiny silent audio element within the gesture
   * chain to unlock autoplay for the page lifecycle.
   */
  const warmup = useCallback(() => {
    if (warmedRef.current) return;
    try {
      // Tiny silent WAV (44 bytes) — plays instantly, unlocks audio on iOS
      const audio = new Audio(
        "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA",
      );
      audio.play().catch(() => {
        // Fallback: try AudioContext approach
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        // Don't close — keep alive for future use
      });
      warmedRef.current = true;
      console.log("[VoiceOutput] Audio playback unlocked");
    } catch (err) {
      console.warn("[VoiceOutput] Warmup failed:", err);
    }
  }, []);

  return {
    isPlaying,
    isLoading,
    error,
    speak,
    stop,
    enabled,
    setEnabled,
    warmup,
  };
}
