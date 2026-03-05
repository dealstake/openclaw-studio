"use client";

/**
 * useVoiceModeBridge — Connects voice mode state to STT/TTS hooks.
 *
 * Architecture (server-side STT):
 * 1. User taps mic → getUserMedia + MediaRecorder (useVoiceClient)
 * 2. VAD detects silence → audio blob POST'd to /api/voice/transcribe
 * 3. Server calls ElevenLabs Scribe REST API → returns transcript
 * 4. Transcript sent to agent via onUserMessage (chat.send over existing WS)
 * 5. Agent response → TTS via /api/tts → AudioContext playback
 * 6. After TTS finishes → auto-restart recording for next turn
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useVoiceModeSafe } from "../providers/VoiceModeProvider";
import { useVoiceClient } from "./useVoiceClient";
import { useVoiceOutput, resolvedToSpeakOptions } from "./useVoiceOutput";
import { useVoiceSettings } from "./useVoiceSettings";
import { createStudioSettingsCoordinator } from "@/lib/studio/coordinator";

interface UseVoiceModeBridgeOptions {
  /** Callback when user finishes speaking — send text to agent */
  onUserMessage?: (text: string) => void;
}

export function useVoiceModeBridge(options?: UseVoiceModeBridgeOptions) {
  const voiceMode = useVoiceModeSafe();
  const voice = useVoiceClient();

  // Keep onUserMessage in a ref to avoid stale closures in effects
  const onUserMessageRef = useRef(options?.onUserMessage);
  useEffect(() => {
    onUserMessageRef.current = options?.onUserMessage;
  }, [options?.onUserMessage]);
  const tts = useVoiceOutput();
  const [coordinator] = useState(() =>
    createStudioSettingsCoordinator({ debounceMs: 200 }),
  );
  const voiceSettings = useVoiceSettings({
    settingsCoordinator: coordinator,
    agentId: voiceMode?.activeAgentId,
  });

  const prevFinalRef = useRef("");

  const voiceModeActive = !!(voiceMode?.isOverlayOpen || voiceMode?.isMinimized);

  /**
   * Start voice mode — MUST be called from a user gesture (click/tap handler).
   * getUserMedia happens in the same gesture chain for iOS Safari.
   */
  const startVoiceMode = useCallback(
    async (agentId: string) => {
      if (!voiceMode) return;

      console.log("[VoiceModeBridge] startVoiceMode called from user gesture");

      // Open the UI immediately
      voiceMode.openVoiceMode(agentId);
      tts.warmup();

      // Start recording in the SAME call chain as the user gesture
      try {
        console.log("[VoiceModeBridge] Starting voice input...");
        await voice.startListening();
        console.log("[VoiceModeBridge] Voice input started successfully");
      } catch (err) {
        const msg = (err as Error).message || "";
        console.error("[VoiceModeBridge] Voice input start failed:", msg);
        if (
          msg.includes("NotAllowedError") ||
          msg.includes("Permission denied") ||
          msg.includes("not found")
        ) {
          voiceMode.setState("idle");
          voiceMode.setLastError("mic-denied");
        } else if (
          msg.includes("API key") ||
          msg.includes("api key") ||
          msg.includes("401")
        ) {
          voiceMode.setState("idle");
          voiceMode.setLastError("api-key-missing");
        } else {
          console.error("[VoiceModeBridge] Unknown error, closing voice mode");
          voiceMode.closeVoiceMode();
        }
      }
    },
    [voiceMode, voice, tts],
  );

  // When voice mode closes, stop recording + TTS
  useEffect(() => {
    if (!voiceMode) return;

    if (!voiceModeActive) {
      if (voice.isListening) {
        voice.stopListening();
      }
      tts.stop();
    }
  }, [voiceModeActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Map voice client status to VoiceMode provider state
  useEffect(() => {
    if (!voiceMode || !voiceModeActive) return;

    // Update user transcript display
    if (voice.transcript && voice.status !== "transcribing") {
      voiceMode.setUserTranscript(voice.transcript);
    }

    // Map status to overlay state
    switch (voice.status) {
      case "requesting-mic":
        voiceMode.setState("connecting");
        break;
      case "listening":
        if (
          voiceMode.state === "connecting" ||
          voiceMode.state === "idle"
        ) {
          console.log("[VoiceModeBridge] Now listening");
          voiceMode.setState("listening");
        }
        break;
      case "transcribing":
        voiceMode.setUserTranscript(voice.transcript);
        // Don't change state — stay in "listening" visually while transcribing
        break;
      case "error":
        if (voiceMode.state === "connecting") {
          voiceMode.setState("idle");
        }
        break;
    }
  }, [voice.status, voice.transcript, voiceMode, voiceModeActive]);

  // On new committed transcript, send to agent
  useEffect(() => {
    if (!voiceMode || !voice.finalTranscript) return;
    if (voice.finalTranscript === prevFinalRef.current) return;

    console.log(
      "[VoiceModeBridge] New transcript:",
      voice.finalTranscript.substring(0, 80),
    );
    prevFinalRef.current = voice.finalTranscript;

    if (onUserMessageRef.current) {
      console.log("[VoiceModeBridge] Sending to agent via onUserMessage");
      onUserMessageRef.current(voice.finalTranscript);
      voiceMode.setState("thinking");
    } else {
      console.warn(
        "[VoiceModeBridge] No onUserMessage callback — transcript not sent!",
      );
    }
  }, [voiceMode, voice.finalTranscript]);

  // Track active state in ref so async speakResponse can check it
  const voiceModeActiveRef = useRef(voiceModeActive);
  useEffect(() => {
    voiceModeActiveRef.current = voiceModeActive;
  }, [voiceModeActive]);

  // Speak agent response
  const speakResponse = useCallback(
    async (text: string) => {
      console.log(
        "[VoiceModeBridge] speakResponse called, text length:",
        text.length,
        "voiceModeActive:",
        voiceModeActiveRef.current,
      );
      if (!voiceMode || !voiceModeActiveRef.current) {
        console.log("[VoiceModeBridge] speakResponse skipped — not active");
        return;
      }

      voiceMode.setAgentTranscript(text);
      voiceMode.setState("speaking");

      const speakOpts = resolvedToSpeakOptions(voiceSettings.settings);
      console.log(
        "[VoiceModeBridge] TTS speak, voiceId:",
        speakOpts.voiceId,
        "modelId:",
        speakOpts.modelId,
      );
      try {
        await tts.speak(text, speakOpts);
        console.log("[VoiceModeBridge] TTS speak completed");
      } catch (err) {
        console.error(
          "[VoiceModeBridge] TTS speak failed:",
          (err as Error).message,
        );
      }

      // Reset state if voice mode is still active — recording auto-restarts
      // via useVoiceClient's sessionActive mechanism
      if (voiceModeActiveRef.current) {
        voiceMode.setState("listening");
        voiceMode.setAgentTranscript("");
        voice.resetTranscript();
        prevFinalRef.current = "";
        console.log("[VoiceModeBridge] Reset to listening state");
      }
    },
    [voiceMode, voiceSettings.settings, tts, voice],
  );

  // Listen for force-commit events from the overlay (tap-to-send)
  useEffect(() => {
    const handler = () => {
      console.log("[VoiceModeBridge] Force-commit event received");
      voice.forceCommit();
    };
    window.addEventListener("voicemode:forcecommit", handler);
    return () => window.removeEventListener("voicemode:forcecommit", handler);
  }, [voice]);

  // Update volume refs for Orb visualization
  useEffect(() => {
    if (!voiceMode) return;
    voiceMode.setOutputVolume(tts.isPlaying ? 0.7 : 0);
  }, [tts.isPlaying, voiceMode]);

  return {
    /** Start voice mode — MUST be called from user gesture (click handler) */
    startVoiceMode,
    /** Call this when agent sends a response to speak it */
    speakResponse,
    /** Force-commit current recording (tap-to-send on overlay) */
    forceCommit: voice.forceCommit,
    /** Whether recording is active */
    isListening: voice.isListening,
    /** Whether TTS is playing */
    isSpeaking: tts.isPlaying,
    /** Voice settings for current agent */
    voiceSettings,
  };
}
