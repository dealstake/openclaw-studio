"use client";

/**
 * Voice output hook — plays AI responses as speech via ElevenLabs TTS.
 *
 * Calls /api/tts (server-side proxy to ElevenLabs) and plays the returned
 * audio/mpeg stream in the browser.
 */

import { useCallback, useRef, useState } from "react";

export interface UseVoiceOutputReturn {
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Whether TTS is loading (fetching audio) */
  isLoading: boolean;
  /** Speak the given text */
  speak: (text: string) => Promise<void>;
  /** Stop current playback */
  stop: () => void;
  /** Last error */
  error: string | null;
  /** Whether voice output is enabled */
  enabled: boolean;
  /** Toggle voice output on/off */
  setEnabled: (enabled: boolean) => void;
}

export function useVoiceOutput(): UseVoiceOutputReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  const speak = useCallback(
    async (text: string) => {
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
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({ error: "TTS failed" }));
          throw new Error((errBody as { error?: string }).error || `TTS failed: ${res.status}`);
        }

        // Use MediaSource for streaming playback when available, else blob fallback
        if (typeof MediaSource !== "undefined" && MediaSource.isTypeSupported("audio/mpeg")) {
          const mediaSource = new MediaSource();
          const url = URL.createObjectURL(mediaSource);
          const audio = new Audio(url);
          audioRef.current = audio;

          mediaSource.addEventListener("sourceopen", async () => {
            const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");
            const reader = res.body?.getReader();
            if (!reader) {
              mediaSource.endOfStream();
              return;
            }

            const pump = async (): Promise<void> => {
              const { done, value } = await reader.read();
              if (done) {
                if (mediaSource.readyState === "open") mediaSource.endOfStream();
                return;
              }
              // Wait for buffer to be ready before appending
              if (sourceBuffer.updating) {
                await new Promise<void>((r) => sourceBuffer.addEventListener("updateend", () => r(), { once: true }));
              }
              sourceBuffer.appendBuffer(value);
              await new Promise<void>((r) => sourceBuffer.addEventListener("updateend", () => r(), { once: true }));
              return pump();
            };

            void pump();
          });

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

          await audio.play();
        } else {
          // Fallback: download full blob then play (Safari, older browsers)
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

  return {
    isPlaying,
    isLoading,
    error,
    speak,
    stop,
    enabled,
    setEnabled,
  };
}
