"use client";

/**
 * useVoiceModeBridge — Connects voice mode state to STT/TTS hooks.
 *
 * When voice mode opens:
 * 1. Starts STT (useVoiceClient) → feeds transcript to VoiceModeProvider
 * 2. On committed transcript → sends to agent via onUserMessage callback
 * 3. On agent response → feeds to TTS (useVoiceOutput) → updates provider
 *
 * STT starts automatically when voiceModeActive becomes true.
 * The useVoiceClient hook pre-acquires mic permission before Scribe.connect(),
 * so getUserMedia succeeds even when called outside the user gesture window.
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
  const [coordinator] = useState(() => createStudioSettingsCoordinator({ debounceMs: 200 }));
  const voiceSettings = useVoiceSettings({
    settingsCoordinator: coordinator,
    agentId: voiceMode?.activeAgentId,
  });

  const prevFinalRef = useRef("");

  const voiceModeActive = !!(voiceMode?.isOverlayOpen || voiceMode?.isMinimized);

  /**
   * Start voice mode — MUST be called from a user gesture (click/tap handler).
   * This calls getUserMedia + Scribe.connect in the same gesture chain,
   * which is required for iOS Safari.
   */
  const startVoiceMode = useCallback(async (agentId: string) => {
    if (!voiceMode) return;

    console.log("[VoiceModeBridge] startVoiceMode called from user gesture");

    // Open the UI immediately
    voiceMode.openVoiceMode(agentId);
    tts.warmup();

    // Start STT in the SAME call chain as the user gesture
    try {
      console.log("[VoiceModeBridge] Starting STT in gesture chain...");
      await voice.startListening();
      console.log("[VoiceModeBridge] STT started successfully");
    } catch (err) {
      const msg = (err as Error).message || "";
      console.error("[VoiceModeBridge] STT start failed:", msg);
      if (msg.includes("NotAllowedError") || msg.includes("Permission denied") || msg.includes("not found")) {
        voiceMode.setState("idle");
        voiceMode.setLastError("mic-denied");
      } else if (msg.includes("API key") || msg.includes("api key") || msg.includes("401")) {
        voiceMode.setState("idle");
        voiceMode.setLastError("api-key-missing");
      } else {
        // Unknown error — close the overlay so user isn't stuck
        console.error("[VoiceModeBridge] Unknown error, closing voice mode");
        voiceMode.closeVoiceMode();
      }
    }
  }, [voiceMode, voice, tts]);

  // When voice mode closes, stop STT + TTS
  useEffect(() => {
    if (!voiceMode) return;

    if (!voiceModeActive) {
      if (voice.isListening) {
        voice.stopListening();
      }
      tts.stop();
    }
  }, [voiceModeActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Feed transcript to provider + update state from STT status
  useEffect(() => {
    if (!voiceMode) return;

    // Update user transcript display
    if (voice.transcript) {
      voiceMode.setUserTranscript(voice.transcript);
    }

    // Update state based on STT status
    if (voice.isConnecting) {
      voiceMode.setState("connecting");
    } else if (voice.isListening) {
      if (voiceMode.state === "connecting") {
        console.log("[VoiceModeBridge] STT connected! Transitioning to listening, releasing pre-acquired stream...");
        voiceMode.setState("listening");
        // Release the pre-acquired mic stream from VoiceModeButton click handler.
        // Scribe now has its own mic stream via internal getUserMedia.
        if (voiceMode.getMicStream()) {
          voiceMode.setMicStream(null);
          console.log("[VoiceModeBridge] Pre-acquired mic stream released");
        }
      }
    } else if (voice.error && voiceMode.state === "connecting") {
      voiceMode.setState("idle");
    }
  }, [voice.transcript, voice.isConnecting, voice.isListening, voice.error]); // eslint-disable-line react-hooks/exhaustive-deps

  // On new committed transcript, send to agent
  useEffect(() => {
    if (!voiceMode || !voice.finalTranscript) return;
    if (voice.finalTranscript === prevFinalRef.current) return;

    console.log("[VoiceModeBridge] New committed transcript:", voice.finalTranscript.substring(0, 80));
    prevFinalRef.current = voice.finalTranscript;

    if (onUserMessageRef.current) {
      console.log("[VoiceModeBridge] Sending to agent via onUserMessage");
      onUserMessageRef.current(voice.finalTranscript);
      voiceMode.setState("thinking");
    } else {
      console.warn("[VoiceModeBridge] No onUserMessage callback — transcript not sent to agent!");
    }
  }, [voice.finalTranscript]); // eslint-disable-line react-hooks/exhaustive-deps

  // Track active state in ref so async speakResponse can check it
  const voiceModeActiveRef = useRef(voiceModeActive);
  useEffect(() => {
    voiceModeActiveRef.current = voiceModeActive;
  }, [voiceModeActive]);

  // Speak agent response
  const speakResponse = useCallback(
    async (text: string) => {
      console.log("[VoiceModeBridge] speakResponse called, text length:", text.length, "voiceModeActive:", voiceModeActiveRef.current);
      if (!voiceMode || !voiceModeActiveRef.current) {
        console.log("[VoiceModeBridge] speakResponse skipped — voiceMode:", !!voiceMode, "active:", voiceModeActiveRef.current);
        return;
      }

      voiceMode.setAgentTranscript(text);
      voiceMode.setState("speaking");

      const speakOpts = resolvedToSpeakOptions(voiceSettings.settings);
      console.log("[VoiceModeBridge] Calling TTS speak, voiceId:", speakOpts.voiceId, "modelId:", speakOpts.modelId);
      try {
        await tts.speak(text, speakOpts);
        console.log("[VoiceModeBridge] TTS speak completed");
      } catch (err) {
        console.error("[VoiceModeBridge] TTS speak failed:", (err as Error).message);
      }

      // Only reset state if voice mode is still active
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
    /** Force-commit current partial transcript (tap-to-send on overlay) */
    forceCommit: voice.forceCommit,
    /** Whether STT is active */
    isListening: voice.isListening,
    /** Whether TTS is playing */
    isSpeaking: tts.isPlaying,
    /** Voice settings for current agent */
    voiceSettings,
  };
}
