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

  // Start/stop STT when voice mode opens/closes
  useEffect(() => {
    if (!voiceMode) return;

    if (voiceMode.isOverlayOpen || voiceMode.isMinimized) {
      if (!voice.isListening && !voice.isConnecting) {
        void voice.startListening();
      }
    } else {
      if (voice.isListening) {
        voice.stopListening();
      }
    }
  }, [voiceMode?.isOverlayOpen, voiceMode?.isMinimized]); // eslint-disable-line react-hooks/exhaustive-deps

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
    }
  }, [voice.transcript, voice.isConnecting, voice.isListening]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Speak agent response
  const speakResponse = useCallback(
    async (text: string) => {
      if (!voiceMode) return;

      voiceMode.setAgentTranscript(text);
      voiceMode.setState("speaking");

      const speakOpts = resolvedToSpeakOptions(voiceSettings.settings);
      await tts.speak(text, speakOpts);

      // After speaking, go back to listening
      voiceMode.setState("listening");
      voiceMode.setAgentTranscript("");
      voice.resetTranscript();
      prevFinalRef.current = "";
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
