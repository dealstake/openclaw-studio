"use client";

import { useCallback, useRef, useState } from "react";
import type { ScoringDimension, PracticeScore } from "../lib/personaTypes";
import type {
  PracticeSession,
  PracticeSessionStatus,
  PracticeTranscriptEntry,
  PracticeConfig,
  ScenarioProfile,
} from "../lib/practiceTypes";
import { DEFAULT_SCORING_DIMENSIONS } from "../lib/personaConstants";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePracticeSessionReturn {
  session: PracticeSession | null;
  starting: boolean;
  evaluating: boolean;
  error: string | null;
  startSession: (config: PracticeConfig) => void;
  addUserMessage: (content: string) => void;
  addPersonaMessage: (content: string) => void;
  endSession: () => void;
  setScore: (score: PracticeScore) => void;
  abandonSession: () => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

let sessionCounter = 0;

function generateSessionId(): string {
  sessionCounter += 1;
  return `practice-${Date.now()}-${sessionCounter}`;
}

export function usePracticeSession(): UsePracticeSessionReturn {
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [starting, setStarting] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<PracticeSession | null>(null);

  const startSession = useCallback((config: PracticeConfig) => {
    setStarting(true);
    setError(null);

    const dimensions: ScoringDimension[] =
      config.customDimensions ?? DEFAULT_SCORING_DIMENSIONS[config.mode] ?? [];

    const defaultProfile: ScenarioProfile = {
      mode: "scenario",
      name: "Free Practice",
      description: "Open-ended practice session",
      difficulty: config.difficulty ?? "medium",
      setup: "Practice your skills in an open-ended session.",
      goals: ["Demonstrate competence in your role"],
      successCriteria: ["Clear communication", "Accurate responses"],
    };

    const newSession: PracticeSession = {
      sessionId: generateSessionId(),
      personaId: config.personaId,
      mode: config.mode,
      status: "active",
      scoringDimensions: dimensions,
      startedAt: new Date().toISOString(),
      endedAt: null,
      score: null,
      transcript: [],
      scenarioProfile: config.scenarioProfile ?? defaultProfile,
    };

    sessionRef.current = newSession;
    setSession(newSession);
    setStarting(false);
  }, []);

  const addMessage = useCallback(
    (role: PracticeTranscriptEntry["role"], content: string) => {
      setSession((prev) => {
        if (!prev || prev.status !== "active") return prev;
        const entry: PracticeTranscriptEntry = {
          role,
          content,
          timestamp: new Date().toISOString(),
        };
        const updated = { ...prev, transcript: [...prev.transcript, entry] };
        sessionRef.current = updated;
        return updated;
      });
    },
    [],
  );

  const addUserMessage = useCallback(
    (content: string) => addMessage("user", content),
    [addMessage],
  );

  const addPersonaMessage = useCallback(
    (content: string) => addMessage("persona", content),
    [addMessage],
  );

  const endSession = useCallback(() => {
    setEvaluating(true);
    setSession((prev) => {
      if (!prev) return prev;
      const updated: PracticeSession = {
        ...prev,
        status: "completed" as PracticeSessionStatus,
        endedAt: new Date().toISOString(),
      };
      sessionRef.current = updated;
      return updated;
    });
  }, []);

  const setScore = useCallback((score: PracticeScore) => {
    setSession((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, score };
      sessionRef.current = updated;
      return updated;
    });
    setEvaluating(false);
  }, []);

  const abandonSession = useCallback(() => {
    setSession((prev) => {
      if (!prev) return prev;
      const updated: PracticeSession = {
        ...prev,
        status: "abandoned" as PracticeSessionStatus,
        endedAt: new Date().toISOString(),
      };
      sessionRef.current = updated;
      return updated;
    });
    setEvaluating(false);
  }, []);

  const reset = useCallback(() => {
    sessionRef.current = null;
    setSession(null);
    setStarting(false);
    setEvaluating(false);
    setError(null);
  }, []);

  return {
    session,
    starting,
    evaluating,
    error,
    startSession,
    addUserMessage,
    addPersonaMessage,
    endSession,
    setScore,
    abandonSession,
    reset,
  };
}
