"use client";

/**
 * VoiceFloatingPill — Minimized voice mode indicator.
 *
 * Shows when voice mode is active but minimized. Displays a pulsing
 * indicator with the current state. Tap/click to expand back to overlay.
 */

import React, { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceMode } from "../providers/VoiceModeProvider";
import type { VoiceModeState } from "../lib/voiceTypes";

// ── Helpers ─────────────────────────────────────────────────────────────

function pillColor(state: VoiceModeState): string {
  switch (state) {
    case "listening":
      return "bg-emerald-500 shadow-emerald-500/30";
    case "thinking":
      return "bg-amber-500 shadow-amber-500/30";
    case "speaking":
      return "bg-blue-500 shadow-blue-500/30";
    case "connecting":
      return "bg-violet-500 shadow-violet-500/30";
    case "idle":
    default:
      return "bg-muted-foreground shadow-none";
  }
}

function pillLabel(state: VoiceModeState): string {
  switch (state) {
    case "listening":
      return "Listening";
    case "thinking":
      return "Thinking";
    case "speaking":
      return "Speaking";
    case "connecting":
      return "Connecting";
    case "idle":
    default:
      return "Voice";
  }
}

// ── Component ───────────────────────────────────────────────────────────

export const VoiceFloatingPill = React.memo(function VoiceFloatingPill() {
  const { state, isMinimized, expandVoiceMode } = useVoiceMode();

  const colorClass = useMemo(() => pillColor(state), [state]);

  return (
    <AnimatePresence>
      {isMinimized && (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 20 }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
          onClick={expandVoiceMode}
          className={cn(
            "fixed z-40",
            "bottom-[calc(4.5rem+var(--mobile-nav-height,0px)+env(safe-area-inset-bottom))]",
            // Mobile: centered, 56px for easier tap; Desktop: bottom-right, 48px circular
            "left-1/2 -translate-x-1/2 min-h-[56px] md:left-auto md:right-4 md:translate-x-0 md:min-h-[48px]",
            "flex items-center gap-2 rounded-full px-4 py-3",
            "bg-card border border-border shadow-lg",
            "text-sm font-medium text-foreground",
            "transition-shadow hover:shadow-xl",
            "focus-ring",
          )}
          aria-label={`Voice mode ${pillLabel(state).toLowerCase()} — tap to expand`}
        >
          {/* Pulsing dot */}
          <div className="relative flex h-3 w-3 items-center justify-center">
            <div
              className={cn(
                "absolute h-3 w-3 rounded-full opacity-75",
                colorClass,
                state !== "idle" && "animate-ping",
              )}
            />
            <div className={cn("relative h-2 w-2 rounded-full", colorClass)} />
          </div>

          <span>{pillLabel(state)}</span>

          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
        </motion.button>
      )}
    </AnimatePresence>
  );
});
