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

// Singleton AudioContext — shared across all hook instances on the page.
// Created once during first warmup(), stays alive for page lifecycle.
let globalAudioContext: AudioContext | null = null;

function getOrCreateAudioContext(): AudioContext {
  if (!globalAudioContext || globalAudioContext.state === "closed") {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    globalAudioContext = new AudioCtx();
  }
  return globalAudioContext;
}

export function useVoiceOutput(): UseVoiceOutputReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const warmedRef = useRef(false);
  // Gain node for volume control
  const gainRef = useRef<GainNode | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch {
        // Already stopped — ignore
      }
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }

    setIsPlaying(false);
    setIsLoading(false);
  }, []);

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
        // Get or create AudioContext
        const audioCtx = getOrCreateAudioContext();

        // Ensure AudioContext is running (iOS Safari suspends it)
        if (audioCtx.state === "suspended") {
          console.log("[VoiceOutput] AudioContext suspended, resuming...");
          await audioCtx.resume();
        }

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

        // Get audio as ArrayBuffer for Web Audio API decoding
        const arrayBuffer = await res.arrayBuffer();
        console.log("[VoiceOutput] TTS response OK, buffer size:", arrayBuffer.byteLength);

        if (controller.signal.aborted) return;

        // Decode audio data
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        console.log("[VoiceOutput] Audio decoded, duration:", audioBuffer.duration.toFixed(1), "s");

        if (controller.signal.aborted) return;

        // Create source node and connect to output
        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;

        // Create gain node if not exists
        if (!gainRef.current || gainRef.current.context !== audioCtx) {
          gainRef.current = audioCtx.createGain();
          gainRef.current.connect(audioCtx.destination);
        }

        source.connect(gainRef.current);
        sourceRef.current = source;

        source.onended = () => {
          console.log("[VoiceOutput] Playback ended");
          setIsPlaying(false);
          sourceRef.current = null;
        };

        // Start playback
        source.start(0);
        setIsPlaying(true);
        setIsLoading(false);
        console.log("[VoiceOutput] Playback started");
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("[VoiceOutput] Error:", err);
        setError((err as Error).message || "TTS failed");
        setIsLoading(false);
        setIsPlaying(false);
      }
    },
    [stop],
  );

  /**
   * Pre-warm the AudioContext during a user gesture (e.g., clicking "Open voice mode").
   * This is CRITICAL for iOS Safari — the AudioContext must be created/resumed within
   * a user gesture to unlock audio playback. After this, all subsequent audio plays
   * through the AudioContext will work without gesture requirements.
   *
   * Pattern: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices
   */
  const warmup = useCallback(() => {
    if (warmedRef.current) return;
    try {
      const audioCtx = getOrCreateAudioContext();

      // Resume if suspended (required on iOS Safari)
      if (audioCtx.state === "suspended") {
        void audioCtx.resume();
      }

      // Play a silent buffer to fully unlock the AudioContext
      const buffer = audioCtx.createBuffer(1, 1, 22050);
      const source = audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(audioCtx.destination);
      source.start(0);

      warmedRef.current = true;
      console.log("[VoiceOutput] AudioContext warmed up, state:", audioCtx.state);
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
