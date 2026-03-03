"use client";

/**
 * Voice output hook — plays AI responses as speech via ElevenLabs TTS.
 *
 * Calls /api/tts (server-side proxy to ElevenLabs) and plays the returned
 * audio/mpeg stream in the browser.
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
  /** Pre-warm audio for iOS Safari — call during user gesture */
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

interface UseVoiceOutputOptions {
  /** ElevenLabs API key from credential vault (passed to TTS route as fallback) */
  apiKey?: string | null;
}

export function useVoiceOutput(options?: UseVoiceOutputOptions): UseVoiceOutputReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const warmedAudioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    setIsPlaying(false);
    setIsLoading(false);
  }, []);

  // Cleanup on unmount — abort pending fetch + stop audio
  useEffect(() => {
    return stop;
  }, [stop]);

  const apiKeyRef = useRef(options?.apiKey);
  useEffect(() => { apiKeyRef.current = options?.apiKey; }, [options?.apiKey]);

  const speak = useCallback(
    async (text: string, speakOpts?: SpeakOptions) => {
      if (!text.trim()) return;

      // Stop any current playback
      stop();

      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            ...(speakOpts?.voiceId ? { voiceId: speakOpts.voiceId } : {}),
            ...(speakOpts?.modelId ? { modelId: speakOpts.modelId } : {}),
            ...(speakOpts?.voiceSettings ? { voiceSettings: speakOpts.voiceSettings } : {}),
            ...(apiKeyRef.current ? { apiKey: apiKeyRef.current } : {}),
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: "TTS failed" }));
          throw new Error((errBody as { error?: string }).error || `TTS failed: ${res.status}`);
        }

        // Standard blob playback — works cross-browser (Chrome, Safari, Firefox, iOS)
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onplay = () => {
          setIsPlaying(true);
          setIsLoading(false);
        };
        audio.onended = () => {
          setIsPlaying(false);
          URL.revokeObjectURL(url);
          audioRef.current = null;
        };
        audio.onerror = () => {
          setError("Failed to play audio");
          setIsPlaying(false);
          setIsLoading(false);
          URL.revokeObjectURL(url);
          audioRef.current = null;
        };

        // iOS Safari requires audio playback to be initiated from a user gesture.
        // We use the pre-warmed audio element if available (warmed during openVoiceMode click).
        if (warmedAudioRef.current) {
          warmedAudioRef.current.src = url;
          warmedAudioRef.current.onplay = audio.onplay;
          warmedAudioRef.current.onended = audio.onended;
          warmedAudioRef.current.onerror = audio.onerror;
          audioRef.current = warmedAudioRef.current;
          await warmedAudioRef.current.play();
        } else {
          // Fallback: create fresh Audio (works on desktop, may fail on iOS)
          await audio.play();
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setError((err as Error).message || "TTS failed");
        setIsLoading(false);
      }
    },
    [stop],
  );

  /**
   * Pre-warm an HTMLAudioElement during a user gesture (e.g., clicking "Open voice mode").
   * This unlocks audio playback on iOS Safari where play() must originate from a user tap.
   * Call this once on the initial click, then TTS can play later without gesture restrictions.
   */
  const warmup = useCallback(() => {
    if (warmedAudioRef.current) return;
    try {
      const audio = new Audio();
      // Load a silent data URI to unlock the audio element
      audio.src = "data:audio/mp3;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdTb3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCBQbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/80DEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVUxBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf/zQsRbAAADSAAAAABVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==";
      void audio.play().then(() => audio.pause()).catch(() => { /* silent failure OK */ });
      warmedAudioRef.current = audio;
    } catch {
      // Audio creation failed — will fall back to fresh Audio() in speak()
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
    /** Call during user gesture to unlock iOS Safari audio playback */
    warmup,
  };
}
