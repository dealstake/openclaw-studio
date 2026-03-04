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
  const tts = useVoiceOutput();
  const [coordinator] = useState(() => createStudioSettingsCoordinator({ debounceMs: 200 }));
  const voiceSettings = useVoiceSettings({
    settingsCoordinator: coordinator,
    agentId: voiceMode?.activeAgentId,
  });

  const prevFinalRef = useRef("");

  const voiceModeActive = !!(voiceMode?.isOverlayOpen || voiceMode?.isMinimized);

  // Start STT when voice mode opens, stop when it closes
  useEffect(() => {
    if (!voiceMode) return;

    if (voiceModeActive) {
      console.log("[VoiceModeBridge] Voice mode active, isListening:", voice.isListening, "isConnecting:", voice.isConnecting);
      if (!voice.isListening && !voice.isConnecting) {
        console.log("[VoiceModeBridge] Starting STT...");
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

    prevFinalRef.current = voice.finalTranscript;

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

  // Update volume refs for Orb visualization
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
