"use client";

/**
 * useVoiceModeBridge — Connects voice mode state to STT/TTS hooks.
 *
 * When voice mode opens:
 * 1. Starts STT (useVoiceClient) → feeds transcript to VoiceModeProvider
 * 2. On committed transcript → sends to agent via gateway chat.send
 * 3. On agent response → feeds to TTS (useVoiceOutput) → updates provider
 *
 * IMPORTANT: STT is started via startListeningNow() which MUST be called
 * from a user gesture handler (click/tap) for iOS Safari getUserMedia.
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

  /**
   * Start STT — MUST be called from a user gesture (click/tap) for iOS Safari.
   * Returns a promise that resolves when connected.
   */
  const startListeningNow = useCallback(async () => {
    if (!voiceMode) return;
    tts.warmup();
    try {
      await voice.startListening();
      voiceMode.setSttStartedFromGesture(true);
    } catch (err) {
      const msg = (err as Error).message || "";
      voiceMode.setState("idle");
      if (msg.includes("NotAllowedError") || msg.includes("Permission denied")) {
        voiceMode.setLastError("mic-denied");
      } else if (msg.includes("API key") || msg.includes("api key") || msg.includes("401")) {
        voiceMode.setLastError("api-key-missing");
      } else if (msg.includes("timeout") || msg.includes("Timeout")) {
        voiceMode.setLastError("mic-denied");
      }
    }
  }, [voiceMode, voice, tts]);

  // Register startListeningNow so VoiceModeButton can call it from gesture
  useEffect(() => {
    if (!voiceMode) return;
    voiceMode.registerStartListening(startListeningNow);
  }, [voiceMode, startListeningNow]);

  // When voice mode opens, start STT if not already started from gesture
  // When voice mode closes, stop STT + TTS
  useEffect(() => {
    if (!voiceMode) return;

    if (voiceModeActive) {
      // If STT wasn't started from user gesture (e.g. keyboard shortcut),
      // start it now. This may fail on iOS Safari but works on desktop.
      if (!voiceMode.sttStartedFromGesture && !voice.isListening && !voice.isConnecting) {
        tts.warmup();
        voice.startListening().catch((err) => {
          const msg = (err as Error).message || "";
          voiceMode.setState("idle");
          if (msg.includes("NotAllowedError") || msg.includes("Permission denied")) {
            voiceMode.setLastError("mic-denied");
          } else if (msg.includes("API key") || msg.includes("api key") || msg.includes("401")) {
            voiceMode.setLastError("api-key-missing");
          }
        });
      }
    } else {
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

      // Only reset state if voice mode is still active
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
    /** Start STT — call from user gesture handler */
    startListeningNow,
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
