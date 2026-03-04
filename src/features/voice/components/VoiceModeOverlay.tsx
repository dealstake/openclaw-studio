"use client";

/**
 * VoiceModeOverlay — Full-screen voice mode experience.
 *
 * Features:
 * - ElevenLabs Orb (WebGL) as central visualizer
 * - Real-time transcript display (user + agent)
 * - State-based color transitions (listening=emerald, thinking=amber, speaking=blue)
 * - Top bar: agent name, connection status, elapsed time, close/minimize
 * - Bottom bar: mic toggle, end call
 * - Framer Motion spring entrance/exit
 * - WCAG AA accessible (focus trap, aria-live, keyboard nav)
 * - Mobile-first: 100dvh, safe areas, 44px touch targets
 */

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import FocusTrap from "focus-trap-react";
import { Minimize2, PhoneOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Orb } from "@/components/ui/orb";
import { BarVisualizer } from "@/components/ui/bar-visualizer";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { useVoiceMode } from "../providers/VoiceModeProvider";
import { MicPermissionDialog } from "./MicPermissionDialog";
import { ApiKeyMissingBanner } from "./ApiKeyMissingBanner";
import { detectVoiceCapability } from "../lib/voiceCapability";
import { voiceModeToOrbState } from "../lib/voiceTypes";
import type { VoiceModeState } from "../lib/voiceTypes";

// ── Helpers ─────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function stateLabel(state: VoiceModeState): string {
  switch (state) {
    case "connecting":
      return "Connecting…";
    case "listening":
      return "Listening";
    case "thinking":
      return "Thinking…";
    case "speaking":
      return "Speaking";
    case "idle":
    default:
      return "";
  }
}

/** State-specific Orb color pairs */
function stateColors(state: VoiceModeState): [string, string] {
  switch (state) {
    case "listening":
      return ["#34D399", "#059669"]; // emerald
    case "thinking":
      return ["#FBBF24", "#D97706"]; // amber
    case "speaking":
      return ["#60A5FA", "#2563EB"]; // blue
    case "connecting":
      return ["#A78BFA", "#7C3AED"]; // violet
    case "idle":
    default:
      return ["#94A3B8", "#64748B"]; // slate
  }
}

/** Status dot color */
function statusDotClass(state: VoiceModeState): string {
  switch (state) {
    case "listening":
      return "bg-emerald-400";
    case "thinking":
      return "bg-amber-400 animate-pulse";
    case "speaking":
      return "bg-blue-400";
    case "connecting":
      return "bg-violet-400 animate-pulse";
    case "idle":
    default:
      return "bg-muted-foreground/50";
  }
}

// ── Component ───────────────────────────────────────────────────────────

export const VoiceModeOverlay = React.memo(function VoiceModeOverlay() {
  const {
    state,
    lastError,
    isOverlayOpen,
    activeAgentId,
    userTranscript,
    agentTranscript,
    closeVoiceMode,
    minimizeVoiceMode,
    setLastError,
    inputVolumeRef,
    outputVolumeRef,
    elapsedSeconds,
  } = useVoiceMode();

  const overlayRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  // Detect voice capability tier
  const capability = useMemo(() => detectVoiceCapability(), []);

  // Derive dialog visibility from lastError (no effect needed)
  const isActive = isOverlayOpen || state !== "idle";
  const showMicDialog = isActive && lastError === "mic-denied";
  const showApiKeyBanner = isActive && lastError === "api-key-missing";

  // Focus overlay on open (FocusTrap handles actual trapping)
  useEffect(() => {
    if (isOverlayOpen && overlayRef.current) {
      overlayRef.current.focus();
    }
  }, [isOverlayOpen]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        minimizeVoiceMode();
      }
      // Space as push-to-talk interrupt — only when not in an input
      if (e.key === " " && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        // Space during speaking = interrupt (close and go back to chat)
        if (state === "speaking") {
          closeVoiceMode();
        }
      }
    },
    [minimizeVoiceMode, closeVoiceMode, state],
  );

  // Screen Wake Lock
  useEffect(() => {
    if (!isOverlayOpen) return;

    let wakeLock: WakeLockSentinel | null = null;
    let cancelled = false;

    async function requestWakeLock() {
      try {
        if ("wakeLock" in navigator) {
          const lock = await navigator.wakeLock.request("screen");
          if (cancelled) {
            void lock.release();
          } else {
            wakeLock = lock;
          }
        }
      } catch {
        // Wake Lock not supported or denied — non-critical
      }
    }

    void requestWakeLock();

    return () => {
      cancelled = true;
      void wakeLock?.release();
    };
  }, [isOverlayOpen]);

  const orbState = useMemo(() => voiceModeToOrbState(state), [state]);
  const colors = useMemo(() => stateColors(state), [state]);

  const hasWebGL = capability.hasWebGL;

  const motionTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : { type: "spring" as const, damping: 25, stiffness: 200 };

  return (
    <>
    <AnimatePresence>
      {isOverlayOpen && (
        <FocusTrap focusTrapOptions={{ allowOutsideClick: true, escapeDeactivates: false }}>
        <motion.div
          ref={overlayRef}
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95 }}
          transition={motionTransition}
          className={cn(
            "fixed inset-0 z-50 flex flex-col",
            "bg-background/95 backdrop-blur-xl",
            "h-[100dvh]",
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            "pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
          )}
          role="dialog"
          aria-modal="true"
          aria-label="Voice mode"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
        >
          {/* ── Top Bar ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              {/* Status dot */}
              <div
                className={cn("h-2 w-2 rounded-full", statusDotClass(state))}
                aria-hidden="true"
              />
              {/* Agent name + status */}
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">
                  {activeAgentId
                    ? activeAgentId.charAt(0).toUpperCase() + activeAgentId.slice(1)
                    : "Voice Mode"}
                </span>
                <span
                  className="text-xs text-muted-foreground"
                  role="status"
                  aria-live="polite"
                >
                  {stateLabel(state)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Elapsed time */}
              <span className="text-xs tabular-nums text-muted-foreground">
                {formatElapsed(elapsedSeconds)}
              </span>

              {/* Minimize button */}
              <button
                type="button"
                onClick={minimizeVoiceMode}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full",
                  "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                aria-label="Minimize voice mode"
              >
                <Minimize2 className="h-4 w-4" />
              </button>

              {/* Close button */}
              <button
                type="button"
                onClick={closeVoiceMode}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-full",
                  "text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                aria-label="Close voice mode"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* ── Center: Orb ──────────────────────────────────────── */}
          <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
            {/* API key missing banner */}
            {showApiKeyBanner && (
              <ApiKeyMissingBanner onNavigateToCredentials={() => closeVoiceMode()} />
            )}
            {/* Orb container — responsive sizing */}
            <div
              className="h-[200px] w-[200px] sm:h-[250px] sm:w-[250px] lg:h-[300px] lg:w-[300px]"
              aria-label={`Voice visualizer, currently ${stateLabel(state).toLowerCase()}`}
            >
              {hasWebGL && !prefersReducedMotion ? (
                <Orb
                  agentState={orbState}
                  colors={colors}
                  inputVolumeRef={inputVolumeRef}
                  outputVolumeRef={outputVolumeRef}
                />
              ) : (
                /* Fallback: BarVisualizer for no-WebGL or reduced motion */
                <div className="flex h-full w-full items-center justify-center">
                  <BarVisualizer
                    state={state === "speaking" ? "speaking" : state === "thinking" ? "thinking" : state === "connecting" ? "connecting" : "listening"}
                    barCount={5}
                    className="h-32 w-48"
                  />
                </div>
              )}
            </div>

            {/* ── Transcript area ─────────────────────────────── */}
            <div
              className="flex w-full max-w-lg flex-col items-center gap-3 text-center"
              aria-live="polite"
              aria-atomic="false"
            >
              {/* Agent response */}
              {agentTranscript && (
                <div className="min-h-[2rem]">
                  <ShimmeringText
                    text={agentTranscript}
                    className="text-lg font-medium text-foreground sm:text-xl"
                    aria-hidden="true"
                  />
                  {/* Accessible version */}
                  <span className="sr-only">{agentTranscript}</span>
                </div>
              )}

              {/* User transcript */}
              {userTranscript && (
                <p className="text-sm text-muted-foreground">
                  {userTranscript}
                </p>
              )}

              {/* Empty state */}
              {!userTranscript && !agentTranscript && state === "listening" && (
                <p className="text-sm text-muted-foreground">
                  Start speaking…
                </p>
              )}
            </div>
          </div>

          {/* ── Bottom Bar ───────────────────────────────────────── */}
          <div className="flex items-center justify-center gap-6 px-4 py-6 sm:py-8">
            {/* End call button */}
            <button
              type="button"
              onClick={closeVoiceMode}
              className={cn(
                "flex h-14 w-14 items-center justify-center rounded-full",
                "bg-destructive text-destructive-foreground",
                "transition-transform hover:scale-105 active:scale-95",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                "shadow-lg",
              )}
              aria-label="End voice call"
            >
              <PhoneOff className="h-6 w-6" />
            </button>
          </div>
        </motion.div>
        </FocusTrap>
      )}
    </AnimatePresence>

      {/* Disabled tier — show message instead of overlay */}
      {capability.tier === "disabled" && capability.disabledReason && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95" role="alert">
          <div className="mx-4 max-w-sm text-center">
            <p className="text-sm text-muted-foreground">{capability.disabledReason}</p>
          </div>
        </div>
      )}

      {/* Mic permission dialog */}
      <MicPermissionDialog
        open={showMicDialog}
        onClose={() => setLastError(null)}
        onRetry={() => {
          setLastError(null);
          // Re-attempt opening voice mode — provider will retry mic access
        }}
      />
    </>
  );
});
