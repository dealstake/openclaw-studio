"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  SideSheet,
  SideSheetContent,
  SideSheetHeader,
  SideSheetClose,
  SideSheetBody,
  SideSheetTitle,
} from "@/components/ui/SideSheet";
import { cn } from "@/lib/utils";
import {
  Play,
  Square,
  Send,
  RotateCcw,
  ChevronDown,
  Loader2,
  Phone,
  ClipboardList,
  Headphones,
  PenTool,
  Users,
  BarChart3,
  Crosshair,
} from "lucide-react";
import type { PracticeModeType } from "../lib/personaTypes";
import type { PracticeConfig, PracticeTranscriptEntry } from "../lib/practiceTypes";
import { PRACTICE_MODE_LABELS } from "../lib/personaConstants";
import { usePracticeSession } from "../hooks/usePracticeSession";
import { PracticeScoreCard } from "./PracticeScoreCard";

// ---------------------------------------------------------------------------
// Mode icons
// ---------------------------------------------------------------------------

const MODE_ICONS: Record<PracticeModeType, React.ElementType> = {
  "mock-call": Phone,
  "task-delegation": ClipboardList,
  "ticket-simulation": Headphones,
  "content-review": PenTool,
  interview: Users,
  analysis: BarChart3,
  scenario: Crosshair,
};

// ---------------------------------------------------------------------------
// Transcript bubble
// ---------------------------------------------------------------------------

const TranscriptBubble = React.memo(function TranscriptBubble({
  entry,
}: {
  entry: PracticeTranscriptEntry;
}) {
  const isUser = entry.role === "user";
  const isSystem = entry.role === "system" || entry.role === "evaluator";

  if (isSystem) {
    return (
      <div className="mx-auto max-w-[85%] rounded-lg bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground italic">
        {entry.content}
      </div>
    );
  }

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-bl-md border border-border/30 bg-card text-foreground",
        )}
      >
        {entry.content}
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Mode selector card
// ---------------------------------------------------------------------------

interface ModeCardProps {
  mode: PracticeModeType;
  selected: boolean;
  onSelect: (mode: PracticeModeType) => void;
}

const ModeCard = React.memo(function ModeCard({
  mode,
  selected,
  onSelect,
}: ModeCardProps) {
  const Icon = MODE_ICONS[mode];
  const handleClick = useCallback(() => onSelect(mode), [onSelect, mode]);

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "flex min-h-[44px] items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        selected
          ? "border-primary/40 bg-primary/10 text-foreground"
          : "border-border/30 bg-card text-muted-foreground hover:border-border/60 hover:text-foreground",
      )}
      aria-pressed={selected}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-sm font-medium">{PRACTICE_MODE_LABELS[mode]}</span>
    </button>
  );
});

// ---------------------------------------------------------------------------
// Difficulty selector
// ---------------------------------------------------------------------------

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY_META: Record<Difficulty, { label: string; cls: string }> = {
  easy: { label: "Easy", cls: "text-emerald-500 border-emerald-500/30" },
  medium: { label: "Medium", cls: "text-amber-500 border-amber-500/30" },
  hard: { label: "Hard", cls: "text-red-400 border-red-400/30" },
};

// ---------------------------------------------------------------------------
// PracticeSessionModal
// ---------------------------------------------------------------------------

export interface PracticeSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  personaId: string;
  personaName: string;
  availableModes: PracticeModeType[];
  defaultMode?: PracticeModeType;
}

export const PracticeSessionModal = React.memo(function PracticeSessionModal({
  open,
  onOpenChange,
  personaId,
  personaName,
  availableModes,
  defaultMode,
}: PracticeSessionModalProps) {
  const {
    session,
    evaluating,
    startSession,
    addUserMessage,
    addPersonaMessage,
    endSession,
    setScore,
    abandonSession,
    reset,
  } = usePracticeSession();

  // Pre-session state
  const [selectedMode, setSelectedMode] = useState<PracticeModeType>(
    defaultMode ?? availableModes[0] ?? "scenario",
  );
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  // Chat input
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session?.transcript.length]);

  // Focus input when session starts
  useEffect(() => {
    if (session?.status === "active") {
      inputRef.current?.focus();
    }
  }, [session?.status]);

  // Reset on close
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        if (session?.status === "active") abandonSession();
        reset();
        setInput("");
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset, abandonSession, session?.status],
  );

  const handleStart = useCallback(() => {
    const config: PracticeConfig = {
      personaId,
      mode: selectedMode,
      difficulty,
    };
    startSession(config);

    const openingMessages: Partial<Record<PracticeModeType, string>> = {
      "mock-call": "📞 *Ring ring...* Hello?",
      "task-delegation":
        "Good morning. I've got a packed day — let me know what needs to happen.",
      "ticket-simulation":
        "Hi, I'm having an issue and I really need help with this...",
      "content-review":
        "I have a content brief ready for you. Let me share the details.",
      interview: "Hi, thanks for taking the time to meet with me today.",
      analysis:
        "I've prepared a dataset for your review. Let me walk you through it.",
      scenario: "Let's get started. What would you like to work through?",
    };

    const opening = openingMessages[selectedMode] ?? "Let's begin.";
    setTimeout(() => addPersonaMessage(opening), 100);
  }, [personaId, selectedMode, difficulty, startSession, addPersonaMessage]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !session || session.status !== "active") return;
    addUserMessage(trimmed);
    setInput("");

    // Placeholder — real implementation connects to chat system
    setTimeout(() => {
      addPersonaMessage(
        "*(AI response would appear here — connect to chat system for real inference)*",
      );
    }, 800);
  }, [input, session, addUserMessage, addPersonaMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleEnd = useCallback(() => {
    endSession();
    // Placeholder evaluation
    setTimeout(() => {
      setScore({
        timestamp: new Date().toISOString(),
        overall: 7,
        dimensions: {},
        feedback:
          "Connect practice mode to the real AI chat system to get actual scoring.",
        improvements: [
          "Wire up to agent chat for real AI responses",
          "Implement transcript export",
        ],
      });
    }, 1500);
  }, [endSession, setScore]);

  const isActive = session?.status === "active";
  const isCompleted = session?.status === "completed" && session.score;

  return (
    <SideSheet open={open} onOpenChange={handleOpenChange}>
      <SideSheetContent className="max-w-lg">
        <SideSheetHeader>
          <SideSheetTitle className="text-sm font-semibold">
            {isActive
              ? `Practice — ${PRACTICE_MODE_LABELS[session.mode]}`
              : isCompleted
                ? "Practice Results"
                : `Practice with ${personaName}`}
          </SideSheetTitle>
          <SideSheetClose />
        </SideSheetHeader>

        <SideSheetBody className="flex flex-col gap-4">
          {/* Pre-session: mode + difficulty selection */}
          {!session && (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Practice Mode
                </span>
                <div className="flex flex-col gap-1.5">
                  {availableModes.map((mode) => (
                    <ModeCard
                      key={mode}
                      mode={mode}
                      selected={selectedMode === mode}
                      onSelect={setSelectedMode}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  Difficulty
                </span>
                <div className="flex gap-2">
                  {(["easy", "medium", "hard"] as Difficulty[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={cn(
                        "min-h-[44px] flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                        difficulty === d
                          ? DIFFICULTY_META[d].cls + " bg-card"
                          : "border-border/30 text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {DIFFICULTY_META[d].label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleStart}
                className={cn(
                  "mt-2 flex min-h-[44px] items-center justify-center gap-2 rounded-lg",
                  "bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground",
                  "transition-colors hover:bg-primary/90",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                )}
              >
                <Play className="h-4 w-4" />
                Start Practice
              </button>
            </>
          )}

          {/* Active session: chat transcript */}
          {isActive && (
            <div className="flex flex-1 flex-col">
              {/* Scenario badge */}
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-border/20 bg-muted/20 px-3 py-2">
                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {session.scenarioProfile.name}
                  </span>
                  {" — "}
                  {session.scenarioProfile.difficulty} difficulty
                </span>
              </div>

              {/* Transcript */}
              <div
                ref={scrollRef}
                className="flex flex-1 flex-col gap-2.5 overflow-y-auto pb-3"
                role="log"
                aria-label="Practice transcript"
              >
                {session.transcript.map((entry, i) => (
                  <TranscriptBubble key={i} entry={entry} />
                ))}
              </div>

              {/* Input bar */}
              <div className="flex items-center gap-2 border-t border-border/30 pt-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your response…"
                  aria-label="Practice message input"
                  className={cn(
                    "h-10 flex-1 rounded-lg border border-border/40 bg-background/50 px-3",
                    "text-sm text-foreground placeholder:text-muted-foreground/70",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  )}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim()}
                  aria-label="Send message"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                    input.trim()
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <Send className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleEnd}
                  aria-label="End practice session"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg",
                    "border border-destructive/30 text-destructive transition-colors",
                    "hover:bg-destructive/10",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/60",
                  )}
                >
                  <Square className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Evaluating */}
          {evaluating && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                Evaluating your performance…
              </p>
            </div>
          )}

          {/* Completed: score card */}
          {isCompleted && session.score && (
            <div className="flex flex-col gap-4">
              <PracticeScoreCard
                score={session.score}
                dimensions={session.scoringDimensions}
              />

              <button
                type="button"
                onClick={reset}
                className={cn(
                  "flex min-h-[44px] items-center justify-center gap-2 rounded-lg",
                  "border border-border/40 px-4 py-2.5 text-sm font-medium text-foreground",
                  "transition-colors hover:bg-muted/50",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                )}
              >
                <RotateCcw className="h-4 w-4" />
                Practice Again
              </button>
            </div>
          )}

          {/* Abandoned */}
          {session?.status === "abandoned" && (
            <div className="flex flex-col items-center gap-3 py-12">
              <p className="text-sm text-muted-foreground">
                Session abandoned.
              </p>
              <button
                type="button"
                onClick={reset}
                className="text-sm text-primary hover:underline"
              >
                Start a new session
              </button>
            </div>
          )}
        </SideSheetBody>
      </SideSheetContent>
    </SideSheet>
  );
});
