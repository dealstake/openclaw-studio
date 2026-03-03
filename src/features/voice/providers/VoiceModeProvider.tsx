"use client";

/**
 * VoiceModeProvider — Global context for voice mode state.
 *
 * Wraps the entire app so voice mode persists across navigation.
 * Manages: overlay visibility, voice state machine, active agent binding,
 * STT (useVoiceClient) and TTS (useVoiceOutput) lifecycle.
 *
 * Any chat interface can call `openVoiceMode(agentId)` to launch voice.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { VoiceModeState } from "../lib/voiceTypes";

// ── Context Types ───────────────────────────────────────────────────────

export interface VoiceModeContextValue {
  /** Current voice mode state */
  state: VoiceModeState;
  /** Whether the full-screen overlay is visible */
  isOverlayOpen: boolean;
  /** Whether voice mode is minimized to floating pill */
  isMinimized: boolean;
  /** The agent ID currently in voice mode (null = none) */
  activeAgentId: string | null;
  /** Current user transcript text */
  userTranscript: string;
  /** Current agent response text */
  agentTranscript: string;
  /** Open voice mode for a specific agent */
  openVoiceMode: (agentId: string) => void;
  /** Close voice mode entirely */
  closeVoiceMode: () => void;
  /** Minimize to floating pill */
  minimizeVoiceMode: () => void;
  /** Expand from floating pill to full overlay */
  expandVoiceMode: () => void;
  /** Update voice mode state (used by voice hooks) */
  setState: (state: VoiceModeState) => void;
  /** Update user transcript (used by STT hook) */
  setUserTranscript: (text: string) => void;
  /** Update agent transcript (used by TTS hook) */
  setAgentTranscript: (text: string) => void;
  /** Ref for input volume (0-1) — fed to Orb */
  inputVolumeRef: React.RefObject<number>;
  /** Ref for output volume (0-1) — fed to Orb */
  outputVolumeRef: React.RefObject<number>;
  /** Set input volume (0-1) — safe setter for ref */
  setInputVolume: (v: number) => void;
  /** Set output volume (0-1) — safe setter for ref */
  setOutputVolume: (v: number) => void;
  /** Elapsed seconds since voice mode opened */
  elapsedSeconds: number;
}

const VoiceModeContext = createContext<VoiceModeContextValue | null>(null);

// ── Hook ────────────────────────────────────────────────────────────────

export function useVoiceMode(): VoiceModeContextValue {
  const ctx = useContext(VoiceModeContext);
  if (!ctx) {
    throw new Error("useVoiceMode must be used within VoiceModeProvider");
  }
  return ctx;
}

/**
 * Safe version — returns null outside provider (for components that may
 * render before provider is mounted, e.g. in Storybook or tests).
 */
export function useVoiceModeSafe(): VoiceModeContextValue | null {
  return useContext(VoiceModeContext);
}

// ── Provider ────────────────────────────────────────────────────────────

interface VoiceModeProviderProps {
  children: React.ReactNode;
}

export function VoiceModeProvider({ children }: VoiceModeProviderProps) {
  const [state, setState] = useState<VoiceModeState>("idle");
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [userTranscript, setUserTranscript] = useState("");
  const [agentTranscript, setAgentTranscript] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const inputVolumeRef = useRef<number>(0);
  const outputVolumeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const setInputVolume = useCallback((v: number) => {
    inputVolumeRef.current = v;
  }, []);

  const setOutputVolume = useCallback((v: number) => {
    outputVolumeRef.current = v;
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const openVoiceMode = useCallback(
    (agentId: string) => {
      setActiveAgentId(agentId);
      setIsOverlayOpen(true);
      setIsMinimized(false);
      setState("connecting");
      setUserTranscript("");
      setAgentTranscript("");
      startTimer();
    },
    [startTimer],
  );

  const closeVoiceMode = useCallback(() => {
    setState("idle");
    setIsOverlayOpen(false);
    setIsMinimized(false);
    setActiveAgentId(null);
    setUserTranscript("");
    setAgentTranscript("");
    stopTimer();
    setElapsedSeconds(0);
    inputVolumeRef.current = 0;
    outputVolumeRef.current = 0;
  }, [stopTimer]);

  const minimizeVoiceMode = useCallback(() => {
    setIsMinimized(true);
    setIsOverlayOpen(false);
  }, []);

  const expandVoiceMode = useCallback(() => {
    setIsMinimized(false);
    setIsOverlayOpen(true);
  }, []);

  const value = useMemo<VoiceModeContextValue>(
    () => ({
      state,
      isOverlayOpen,
      isMinimized,
      activeAgentId,
      userTranscript,
      agentTranscript,
      openVoiceMode,
      closeVoiceMode,
      minimizeVoiceMode,
      expandVoiceMode,
      setState,
      setUserTranscript,
      setAgentTranscript,
      inputVolumeRef,
      outputVolumeRef,
      setInputVolume,
      setOutputVolume,
      elapsedSeconds,
    }),
    [
      state,
      isOverlayOpen,
      isMinimized,
      activeAgentId,
      userTranscript,
      agentTranscript,
      openVoiceMode,
      closeVoiceMode,
      minimizeVoiceMode,
      expandVoiceMode,
      setInputVolume,
      setOutputVolume,
      elapsedSeconds,
    ],
  );

  return (
    <VoiceModeContext.Provider value={value}>
      {children}
    </VoiceModeContext.Provider>
  );
}
