"use client";

/**
 * VoiceModeProvider — Global context for voice mode state.
 *
 * Wraps the entire app so voice mode persists across navigation.
 * Manages: overlay visibility, voice state machine, active agent binding.
 * STT and TTS lifecycle are managed by useVoiceModeBridge.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { VoiceModeState } from "../lib/voiceTypes";

// ── Context Types ───────────────────────────────────────────────────────

export interface VoiceModeContextValue {
  /** Current voice mode state */
  state: VoiceModeState;
  /** Last error type for UI handling */
  lastError: "mic-denied" | "api-key-missing" | "quota-exceeded" | null;
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
  /** Set last error type */
  setLastError: (error: VoiceModeContextValue["lastError"]) => void;
  /** Update user transcript (used by STT hook) */
  setUserTranscript: (text: string) => void;
  /** Update agent transcript (used by TTS hook) */
  setAgentTranscript: (text: string) => void;
  /** Store pre-acquired mic stream (kept alive for iOS Safari) */
  setMicStream: (stream: MediaStream | null) => void;
  /** Get current pre-acquired mic stream */
  getMicStream: () => MediaStream | null;
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
 * Safe version — returns null outside provider.
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
  const [lastError, setLastError] = useState<VoiceModeContextValue["lastError"]>(null);
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [userTranscript, setUserTranscript] = useState("");
  const [agentTranscript, setAgentTranscript] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const micStreamRef = useRef<MediaStream | null>(null);

  const setMicStream = useCallback((stream: MediaStream | null) => {
    // Release old stream if replacing
    if (micStreamRef.current && stream !== micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    micStreamRef.current = stream;
  }, []);

  const getMicStream = useCallback(() => micStreamRef.current, []);

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

  // Clean up timer on unmount to prevent leaks
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const openVoiceMode = useCallback(
    (agentId: string) => {
      setActiveAgentId(agentId);
      setIsOverlayOpen(true);
      setIsMinimized(false);
      setState("connecting");
      setLastError(null);
      setUserTranscript("");
      setAgentTranscript("");
      startTimer();
    },
    [startTimer],
  );

  const closeVoiceMode = useCallback(() => {
    setState("idle");
    setLastError(null);
    setIsOverlayOpen(false);
    setIsMinimized(false);
    setActiveAgentId(null);
    setUserTranscript("");
    setAgentTranscript("");
    // Release pre-acquired mic stream
    setMicStream(null);
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
      lastError,
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
      setLastError,
      setUserTranscript,
      setAgentTranscript,
      setMicStream,
      getMicStream,
      inputVolumeRef,
      outputVolumeRef,
      setInputVolume,
      setOutputVolume,
      elapsedSeconds,
    }),
    [
      state,
      lastError,
      isOverlayOpen,
      isMinimized,
      activeAgentId,
      userTranscript,
      agentTranscript,
      openVoiceMode,
      closeVoiceMode,
      minimizeVoiceMode,
      expandVoiceMode,
      setMicStream,
      getMicStream,
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
