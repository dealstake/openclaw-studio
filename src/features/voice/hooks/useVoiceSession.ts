"use client";

/**
 * useVoiceSession — Voice mode hook bridged to VoiceModeProvider overlay.
 *
 * Thin wrapper around useInlineVoice that syncs state to the overlay
 * via VoiceModeProvider. For new inline voice UI, use useInlineVoice directly.
 *
 * Architecture (server-side STT):
 * 1. User taps mic → getUserMedia + MediaRecorder
 * 2. VAD detects silence → audio blob POST'd to /api/voice/transcribe
 * 3. Server calls ElevenLabs Scribe REST API → returns transcript
 * 4. Transcript sent to agent via onUserMessage (chat.send over existing WS)
 * 5. Agent response → TTS via /api/tts → HTMLAudioElement playback
 * 6. After TTS finishes → auto-restart recording for next turn
 */

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useVoiceModeSafe } from "../providers/VoiceModeProvider";
import { useVoiceSettings } from "./useVoiceSettings";
import { useInlineVoice, type InlineVoiceState } from "./useInlineVoice";
import { createStudioSettingsCoordinator } from "@/lib/studio/coordinator";

// Re-export types for backward compatibility
export type SessionStatus = InlineVoiceState;

export interface UseVoiceSessionOptions {
  /** Callback when user finishes speaking — send text to agent */
  onUserMessage?: (text: string) => void;
}

export interface UseVoiceSessionReturn {
  /** Start voice mode — MUST be called from user gesture */
  start: (agentId: string) => Promise<void>;
  /** Call when agent response is ready to speak */
  speakResponse: (text: string) => Promise<void>;
  /** Force-commit current recording */
  forceCommit: () => void;
  /** Whether recording is active */
  isListening: boolean;
  /** Whether TTS is playing */
  isSpeaking: boolean;
  /** Voice settings for current agent */
  voiceSettings: ReturnType<typeof useVoiceSettings>;
}

// ── Hook ──────────────────────────────────────────────────────────────

export function useVoiceSession(options?: UseVoiceSessionOptions): UseVoiceSessionReturn {
  const voiceMode = useVoiceModeSafe();

  // Settings coordinator (stable across renders)
  const coordinator = useMemo(() => createStudioSettingsCoordinator({ debounceMs: 200 }), []);

  const voiceSettings = useVoiceSettings({
    settingsCoordinator: coordinator,
    agentId: voiceMode?.activeAgentId,
  });

  // Keep ref for voiceMode to avoid stale closures
  const voiceModeRef = useRef(voiceMode);
  useEffect(() => { voiceModeRef.current = voiceMode; });

  // Map inline state to VoiceModeState for the overlay
  const handleStateChange = useCallback((state: InlineVoiceState) => {
    const vm = voiceModeRef.current;
    if (!vm) return;
    switch (state) {
      case "listening":
        vm.setState("listening");
        break;
      case "thinking":
      case "transcribing":
        vm.setState("thinking");
        break;
      case "speaking":
        vm.setState("speaking");
        break;
      // idle/error — don't close overlay, let overlay manage its own lifecycle
    }
  }, []);

  const inline = useInlineVoice({
    onUserMessage: options?.onUserMessage,
    onStateChange: handleStateChange,
    agentId: voiceMode?.activeAgentId,
  });

  // Stop inline voice when overlay closes
  const voiceModeActive = !!(voiceMode?.isOverlayOpen || voiceMode?.isMinimized);
  const { state: inlineState, stop: inlineStop, forceCommit: inlineForceCommit } = inline;
  useEffect(() => {
    if (!voiceModeActive && inlineState !== "idle") {
      inlineStop();
    }
  }, [voiceModeActive, inlineState, inlineStop]);

  // Listen for force-commit events from overlay
  useEffect(() => {
    const handler = () => inlineForceCommit();
    window.addEventListener("voicemode:forcecommit", handler);
    return () => window.removeEventListener("voicemode:forcecommit", handler);
  }, [inlineForceCommit]);

  // ── Public API (matches original interface) ────────────────────────

  const start = useCallback(async (agentId: string) => {
    if (!voiceModeRef.current) return;
    voiceModeRef.current.openVoiceMode(agentId);
    await inline.start();
  }, [inline]);

  return {
    start,
    speakResponse: inline.speakResponse,
    forceCommit: inline.forceCommit,
    isListening: inline.isListening,
    isSpeaking: inline.isSpeaking,
    voiceSettings,
  };
}
