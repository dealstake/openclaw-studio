"use client";

/**
 * Voice input hook using ElevenLabs real-time Speech-to-Text WebSocket.
 *
 * Uses MediaRecorder to capture mic audio, sends chunks via WebSocket to
 * ElevenLabs' Scribe STT, and receives partial + committed transcripts.
 *
 * VAD (Voice Activity Detection) auto-commits when the user stops speaking.
 * Partial transcripts update in real-time for live feedback.
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ── Types ───────────────────────────────────────────────────────────────

interface ScribeMessage {
  message_type:
    | "session_started"
    | "partial_transcript"
    | "committed_transcript"
    | "committed_transcript_with_timestamps"
    | "error";
  text?: string;
  error?: string;
  session_id?: string;
}

export interface UseVoiceInputReturn {
  /** Whether the browser supports voice input (MediaRecorder + WebSocket) */
  isSupported: boolean;
  /** Whether actively listening */
  isListening: boolean;
  /** Whether connecting to the STT service */
  isConnecting: boolean;
  /** Current partial transcript (updates in real-time as you speak) */
  transcript: string;
  /** Last committed (final) transcript */
  finalTranscript: string;
  /** Start listening (async — requests mic + connects to STT) */
  startListening: () => void | Promise<void>;
  /** Stop listening */
  stopListening: () => void;
  /** Clear transcript */
  resetTranscript: () => void;
  /** Last error message */
  error: string | null;
}

// Check browser support
function checkSupport(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof WebSocket !== "undefined" &&
    typeof MediaRecorder !== "undefined"
  );
}

export function useVoiceInput(
  lang = "en",
): UseVoiceInputReturn {
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | AudioWorkletNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const isSupported = checkSupport();

  // Cleanup everything
  const cleanup = useCallback(() => {
    // Close WebSocket
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        // Send EOS to flush final transcript
        wsRef.current.send(JSON.stringify({ type: "flush" }));
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    // Stop audio processing
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Stop media stream
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }

    setIsListening(false);
    setIsConnecting(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const startListening = useCallback(async () => {
    if (isListening || isConnecting) return;

    setError(null);
    setIsConnecting(true);

    try {
      // 1. Get mic access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      // 2. Get single-use token from our API
      const tokenRes = await fetch("/api/voice/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "realtime_scribe" }),
      });

      if (!tokenRes.ok) {
        throw new Error("Failed to get voice token");
      }

      const { token } = (await tokenRes.json()) as { token: string };

      // 3. Connect to ElevenLabs real-time STT WebSocket
      const wsUrl = new URL("wss://api.elevenlabs.io/v1/speech-to-text/realtime");
      wsUrl.searchParams.set("token", token);
      wsUrl.searchParams.set("model_id", "scribe_v1");
      wsUrl.searchParams.set("language_code", lang);
      wsUrl.searchParams.set("commit_strategy", "vad");
      wsUrl.searchParams.set("vad_silence_threshold_secs", "1.2");
      wsUrl.searchParams.set("audio_format", "pcm_16000");

      const ws = new WebSocket(wsUrl.toString());
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnecting(false);
        setIsListening(true);

        // 4. Set up audio capture — use ScriptProcessorNode for broad compatibility
        const audioContext = new AudioContext({ sampleRate: 16000 });
        audioContextRef.current = audioContext;

        const source = audioContext.createMediaStreamSource(stream);
        // 4096 buffer size, 1 input channel, 1 output channel
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e: AudioProcessingEvent) => {
          if (ws.readyState !== WebSocket.OPEN) return;

          const inputData = e.inputBuffer.getChannelData(0);
          // Convert Float32 [-1, 1] to Int16 PCM
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          // Send as base64-encoded audio chunk
          const bytes = new Uint8Array(pcm16.buffer);
          let binary = "";
          for (let j = 0; j < bytes.length; j++) {
            binary += String.fromCharCode(bytes[j]);
          }
          const base64 = btoa(binary);

          ws.send(
            JSON.stringify({
              type: "input_audio_chunk",
              audio_chunk: base64,
            }),
          );
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      };

      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data as string) as ScribeMessage;

          switch (msg.message_type) {
            case "partial_transcript":
              if (msg.text) {
                setTranscript(msg.text);
              }
              break;

            case "committed_transcript":
            case "committed_transcript_with_timestamps":
              if (msg.text) {
                setFinalTranscript((prev) => {
                  const combined = prev ? `${prev} ${msg.text}` : msg.text!;
                  setTranscript(combined);
                  return combined;
                });
              }
              break;

            case "error":
              setError(msg.error || "STT error");
              break;
          }
        } catch {
          // Ignore parse errors
        }
      };

      ws.onerror = () => {
        setError("Voice connection failed");
        cleanup();
      };

      ws.onclose = () => {
        if (isListening) {
          cleanup();
        }
      };
    } catch (err) {
      const message =
        (err as Error).message || "Failed to start voice input";
      if (message.includes("Permission denied") || message.includes("NotAllowedError")) {
        setError("Microphone access denied. Please allow mic access and try again.");
      } else {
        setError(message);
      }
      cleanup();
    }
  }, [isListening, isConnecting, lang, cleanup]);

  const stopListening = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setFinalTranscript("");
  }, []);

  return {
    isSupported,
    isListening,
    isConnecting,
    transcript,
    finalTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
