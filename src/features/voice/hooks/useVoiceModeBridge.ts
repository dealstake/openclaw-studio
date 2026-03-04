"use client";

/**
 * useVoiceModeBridge — Connects voice mode state to STT/TTS hooks.
 *
 * When voice mode opens:
 * 1. Starts STT (useVoiceClient) → feeds transcript to VoiceModeProvider
 * 2. On committed transcript → sends to agent via gateway chat.send
 * 3. On agent response → feeds to TTS (useVoiceOutput) → updates provider
 *
 * This hook bridges the display layer (VoiceModeOverlay) to the actual
 * audio pipeline (useVoiceClient + useVoiceOutput).
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
  const tts = useVoiceOutput();
  const [coordinator] = useState(() => createStudioSettingsCoordinator({ debounceMs: 200 }));
  const voiceSettings = useVoiceSettings({
    settingsCoordinator: coordinator,
    agentId: voiceMode?.activeAgentId,
  });

  const prevFinalRef = useRef("");

  const voiceModeActive = !!(voiceMode?.isOverlayOpen || voiceMode?.isMinimized);

  // Start/stop STT + TTS when voice mode opens/closes
  useEffect(() => {
    if (!voiceMode) return;

    if (voiceModeActive) {
      // Warm up audio element for iOS Safari (unlocks playback on user gesture chain)
      tts.warmup();
      if (!voice.isListening && !voice.isConnecting) {
        voice.startListening().catch((err) => {
          const msg = (err as Error).message || "";
          if (msg.includes("NotAllowedError") || msg.includes("Permission denied")) {
            voiceMode.setLastError("mic-denied");
          } else if (msg.includes("API key") || msg.includes("api key") || msg.includes("401")) {
            voiceMode.setLastError("api-key-missing");
          } else if (msg.includes("timeout") || msg.includes("Timeout")) {
            voiceMode.setLastError("mic-denied");
          } else {
            voiceMode.setState("idle");
          }
        });
      }
    } else {
      // Voice mode closed — stop everything
      if (voice.isListening) {
        voice.stopListening();
      }
      tts.stop();
    }
  }, [voiceModeActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // Feed transcript to provider + detect committed segments
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
        voiceMode.setState("listening");
      }
    } else if (voice.error && voiceMode.state === "connecting") {
      // Connection failed — fall back to idle instead of staying stuck on "connecting"
      voiceMode.setState("idle");
    }
  }, [voice.transcript, voice.isConnecting, voice.isListening, voice.error]); // eslint-disable-line react-hooks/exhaustive-deps

  // On new committed transcript, send to agent
  useEffect(() => {
    if (!voiceMode || !voice.finalTranscript) return;
    if (voice.finalTranscript === prevFinalRef.current) return;

    prevFinalRef.current = voice.finalTranscript;

    // Send to agent
    if (options?.onUserMessage) {
      options.onUserMessage(voice.finalTranscript);
      voiceMode.setState("thinking");
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
      if (!voiceMode || !voiceModeActiveRef.current) return;

      voiceMode.setAgentTranscript(text);
      voiceMode.setState("speaking");

      const speakOpts = resolvedToSpeakOptions(voiceSettings.settings);
      await tts.speak(text, speakOpts);

      // Only reset state if voice mode is still active (user didn't close during playback)
      if (voiceModeActiveRef.current) {
        voiceMode.setState("listening");
        voiceMode.setAgentTranscript("");
        voice.resetTranscript();
        prevFinalRef.current = "";
      }
    },
    [voiceMode, voiceSettings.settings, tts, voice],
  );

  // Update volume refs for Orb visualization via provider setter
  useEffect(() => {
    if (!voiceMode) return;

    voiceMode.setOutputVolume(tts.isPlaying ? 0.7 : 0);
  }, [tts.isPlaying, voiceMode]);

  return {
    /** Call this when agent sends a response to speak it */
    speakResponse,
    /** Whether STT is active */
    isListening: voice.isListening,
    /** Whether TTS is playing */
    isSpeaking: tts.isPlaying,
    /** Voice settings for current agent */
    voiceSettings,
  };
}
