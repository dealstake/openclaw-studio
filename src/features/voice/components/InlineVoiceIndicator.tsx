"use client";

/**
 * InlineVoiceIndicator — Small inline pill showing voice state in the composer.
 * Replaces the full-screen overlay with a subtle, non-intrusive indicator.
 */

import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Loader2, Volume2, Brain } from "lucide-react";
import type { InlineVoiceState } from "../hooks/useInlineVoice";

interface InlineVoiceIndicatorProps {
  state: InlineVoiceState;
}

const stateConfig: Record<string, { label: string; icon: typeof Mic; colorClass: string; pulse?: boolean }> = {
  "requesting-mic": { label: "Mic…", icon: Loader2, colorClass: "text-muted-foreground" },
  listening: { label: "Listening", icon: Mic, colorClass: "text-emerald-500", pulse: true },
  transcribing: { label: "Transcribing", icon: Loader2, colorClass: "text-amber-500" },
  thinking: { label: "Thinking", icon: Brain, colorClass: "text-amber-500" },
  speaking: { label: "Speaking", icon: Volume2, colorClass: "text-blue-500", pulse: true },
  error: { label: "Error", icon: Mic, colorClass: "text-destructive" },
};

export const InlineVoiceIndicator = memo(function InlineVoiceIndicator({
  state,
}: InlineVoiceIndicatorProps) {
  const config = stateConfig[state];
  if (!config || state === "idle") return null;

  const Icon = config.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={state}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
        className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${config.colorClass}`}
        role="status"
        aria-live="polite"
      >
        <span className="relative flex h-3 w-3 items-center justify-center">
          {config.pulse && (
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-40 ${
              state === "listening" ? "bg-emerald-400" : "bg-blue-400"
            }`} />
          )}
          <Icon className={`h-3 w-3 ${config.icon === Loader2 ? "animate-spin" : ""}`} />
        </span>
        <span>{config.label}</span>
      </motion.div>
    </AnimatePresence>
  );
});
