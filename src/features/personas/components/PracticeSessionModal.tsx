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
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
} from "lucide-react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { PracticeModeType } from "../lib/personaTypes";
import type { PracticeConfig, PracticeTranscriptEntry } from "../lib/practiceTypes";
import type { PreflightResult } from "../lib/preflightTypes";
import { PRACTICE_MODE_LABELS } from "../lib/personaConstants";
import { usePracticeSession } from "../hooks/usePracticeSession";
import { usePracticeChat } from "../hooks/usePracticeChat";
import { usePersonaHealth } from "../hooks/usePersonaHealth";
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
  easy: { label: "Easy", cls: "text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  medium: { label: "Medium", cls: "text-amber-700 dark:text-amber-500 border-amber-500/30" },
  hard: { label: "Hard", cls: "text-red-600 dark:text-red-400 border-red-400/30" },
};

// ---------------------------------------------------------------------------
// Preflight banner — shown in pre-session mode
// ---------------------------------------------------------------------------

interface PreflightBannerProps {
  checking: boolean;
  result: PreflightResult | null;
  error: string | null;
  onRecheck: () => void;
}

const PreflightBanner = React.memo(function PreflightBanner({
  checking,
  result,
  error,
  onRecheck,
}: PreflightBannerProps) {
  if (checking) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-border/20 bg-muted/20 px-3 py-2.5">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Checking system readiness…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
        <span className="text-xs text-amber-600 dark:text-amber-400">
          Health check unavailable — practice may still proceed.
        </span>
        <button
          type="button"
          onClick={onRecheck}
          aria-label="Retry health check"
          className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      </div>
    );
  }

  if (!result) return null;

  if (result.overall === "ready") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5">
        <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-emerald-500 dark:text-emerald-400" />
        <span className="text-xs text-emerald-700 dark:text-emerald-300">
          All systems ready
        </span>
      </div>
    );
  }

  if (result.overall === "action_needed") {
    const missing = result.capabilities.filter((c) => c.status !== "ready");
    return (
      <div className="flex flex-col gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />
            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Some optional capabilities need setup
            </span>
          </div>
          <button
            type="button"
            onClick={onRecheck}
            aria-label="Re-check readiness"
            className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
        {missing.length > 0 && (
          <ul className="ml-5 flex flex-col gap-0.5">
            {missing.slice(0, 3).map((cap) => (
              <li key={cap.capability} className="text-[11px] text-muted-foreground">
                {cap.displayName}
              </li>
            ))}
            {missing.length > 3 && (
              <li className="text-[11px] text-muted-foreground">
                +{missing.length - 3} more
              </li>
            )}
          </ul>
        )}
        <span className="text-[11px] text-muted-foreground">
          Practice can still proceed. Set up capabilities in the persona settings.
        </span>
      </div>
    );
  }

  // blocked
  const blockedCaps = result.capabilities.filter(
    (c) => c.status !== "ready" && c.required,
  );
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-red-500" />
          <span className="text-xs font-medium text-red-700 dark:text-red-400">
            Required capabilities are missing
          </span>
        </div>
        <button
          type="button"
          onClick={onRecheck}
          aria-label="Re-check readiness"
          className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>
      {blockedCaps.length > 0 && (
        <ul className="ml-5 flex flex-col gap-0.5">
          {blockedCaps.slice(0, 3).map((cap) => (
            <li key={cap.capability} className="text-[11px] text-red-600 dark:text-red-400">
              {cap.displayName}: {cap.details || "Not configured"}
            </li>
          ))}
        </ul>
      )}
      <span className="text-[11px] text-muted-foreground">
        Set up the required capabilities before starting practice.
      </span>
    </div>
  );
});

// ---------------------------------------------------------------------------
// PracticeSessionModal
// ---------------------------------------------------------------------------

export interface PracticeSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: GatewayClient;
  personaId: string;
  personaName: string;
  availableModes: PracticeModeType[];
  defaultMode?: PracticeModeType;
}

export const PracticeSessionModal = React.memo(function PracticeSessionModal({
  open,
  onOpenChange,
  client,
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

  // Real AI chat hook — connects to gateway for live inference
  const practiceChat = usePracticeChat({
    client,
    personaId,
    personaName,
    mode: selectedMode,
    difficulty,
  });

  // Preflight health check — runs automatically when modal opens in pre-session state
  const { checkHealth, checking: healthChecking, healthResult, error: healthError, reset: resetHealth } =
    usePersonaHealth();

  // Chat input
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages or streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [practiceChat.messages.length, practiceChat.streamText, session?.transcript.length]);

  // Focus input when session starts
  useEffect(() => {
    if (session?.status === "active") {
      inputRef.current?.focus();
    }
  }, [session?.status]);

  // Sync real AI messages into the practice session transcript
  useEffect(() => {
    const aiMessages = practiceChat.messages;
    if (aiMessages.length === 0 || !session || session.status !== "active") return;

    // Only process the latest message (avoid re-adding)
    const lastMsg = aiMessages[aiMessages.length - 1];
    const transcriptTexts = new Set(session.transcript.map(t => t.content));

    if (!transcriptTexts.has(lastMsg.content)) {
      if (lastMsg.role === "assistant") {
        addPersonaMessage(lastMsg.content);
      }
    }
  }, [practiceChat.messages, session, addPersonaMessage]);

  // Auto-run preflight when modal opens in pre-session state.
  const personaIdRef = useRef(personaId);
  personaIdRef.current = personaId;
  useEffect(() => {
    if (open && !session) {
      void checkHealth(personaIdRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset on close
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen) {
        if (session?.status === "active") abandonSession();
        reset();
        resetHealth();
        void practiceChat.cleanup();
        setInput("");
      }
      onOpenChange(nextOpen);
    },
    [onOpenChange, reset, abandonSession, resetHealth, practiceChat, session?.status],
  );

  const handleStart = useCallback(() => {
    // Block start if required capabilities are missing
    if (healthResult?.overall === "blocked") return;

    const config: PracticeConfig = {
      personaId,
      mode: selectedMode,
      difficulty,
    };
    startSession(config);

    // Start real AI practice session
    void practiceChat.start();
  }, [personaId, selectedMode, difficulty, startSession, practiceChat, healthResult]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || !session || session.status !== "active") return;

    // Add to local transcript
    addUserMessage(trimmed);
    setInput("");

    // Send to real AI via gateway
    void practiceChat.send(trimmed);
  }, [input, session, addUserMessage, practiceChat]);

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
    // Request real AI evaluation
    void practiceChat.evaluate();
  }, [endSession, practiceChat]);

  // When evaluation response arrives, set the score
  useEffect(() => {
    if (!evaluating) return;

    // Check if the last AI message is an evaluation (after endSession)
    const aiMessages = practiceChat.messages;
    const lastMsg = aiMessages[aiMessages.length - 1];
    if (lastMsg?.role === "assistant" && !practiceChat.isStreaming && session?.status === "completed") {
      // Parse score from the evaluation text
      const scoreMatch = lastMsg.content.match(/(\d+)\s*\/\s*10/);
      const overall = scoreMatch ? parseInt(scoreMatch[1], 10) : 5;

      setScore({
        timestamp: new Date().toISOString(),
        overall,
        dimensions: {},
        feedback: lastMsg.content,
        improvements: [],
      });
    }
  }, [practiceChat.messages, practiceChat.isStreaming, evaluating, session?.status, setScore]);

  const isActive = session?.status === "active";
  const isCompleted = session?.status === "completed" && session.score;
  const isBlocked = healthResult?.overall === "blocked";

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
                      aria-pressed={difficulty === d}
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

              {/* Preflight readiness banner */}
              <PreflightBanner
                checking={healthChecking}
                result={healthResult}
                error={healthError}
                onRecheck={() => void checkHealth(personaId)}
              />

              <button
                type="button"
                onClick={handleStart}
                disabled={healthChecking || isBlocked}
                aria-disabled={healthChecking || isBlocked}
                className={cn(
                  "mt-2 flex min-h-[44px] items-center justify-center gap-2 rounded-lg",
                  "bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground",
                  "transition-colors hover:bg-primary/90",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  (healthChecking || isBlocked) && "cursor-not-allowed opacity-50",
                )}
              >
                {healthChecking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {healthChecking ? "Checking readiness…" : "Start Practice"}
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
                {/* Streaming indicator — show AI typing */}
                {practiceChat.isStreaming && practiceChat.streamText && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] rounded-2xl rounded-bl-md border border-border/30 bg-card px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
                      {practiceChat.streamText}
                      <span className="ml-1 inline-block h-3 w-0.5 animate-pulse bg-foreground/50" />
                    </div>
                  </div>
                )}
                {practiceChat.isStreaming && !practiceChat.streamText && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl rounded-bl-md border border-border/30 bg-card px-3.5 py-2.5">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
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
                    "min-h-[44px] flex-1 rounded-lg border border-border/40 bg-background/50 px-3",
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
                    "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg transition-colors",
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
                    "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg",
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
