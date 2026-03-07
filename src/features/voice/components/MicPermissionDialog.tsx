"use client";

/**
 * MicPermissionDialog — Browser-specific microphone permission instructions.
 *
 * Shown when mic access is denied. Provides step-by-step instructions
 * tailored to the user's browser (Chrome, Safari, Firefox, Edge).
 */

import React, { useMemo } from "react";
import { AlertTriangle, Mic, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { detectBrowser, getMicPermissionSteps } from "../lib/voiceCapability";

interface MicPermissionDialogProps {
  open: boolean;
  onClose: () => void;
  onRetry: () => void;
}

export const MicPermissionDialog = React.memo(function MicPermissionDialog({
  open,
  onClose,
  onRetry,
}: MicPermissionDialogProps) {
  const browser = useMemo(() => detectBrowser(), []);
  const steps = useMemo(() => getMicPermissionSteps(browser), [browser]);
  const browserName = useMemo(() => {
    switch (browser) {
      case "chrome": return "Chrome";
      case "safari": return "Safari";
      case "firefox": return "Firefox";
      case "edge": return "Edge";
      default: return "your browser";
    }
  }, [browser]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Microphone permission required"
    >
      <div
        className={cn(
          "relative mx-4 w-full max-w-md rounded-2xl",
          "bg-background border border-border shadow-2xl",
          "p-6 sm:p-8",
        )}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className={cn(
            "absolute right-3 top-3",
            "flex h-11 w-11 items-center justify-center rounded-full",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            "focus-ring",
          )}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Microphone Access Required
            </h2>
            <p className="text-sm text-muted-foreground">
              Voice mode needs your microphone
            </p>
          </div>
        </div>

        {/* Instructions */}
        <div className="mb-6">
          <p className="mb-3 text-sm text-muted-foreground">
            To enable microphone access in {browserName}:
          </p>
          <ol className="space-y-2">
            {steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <span className="text-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              "flex-1 rounded-lg border border-border px-4 py-2.5",
              "text-sm font-medium text-muted-foreground",
              "hover:bg-muted transition-colors",
              "focus-ring",
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onRetry();
            }}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5",
              "bg-primary text-primary-foreground text-sm font-medium",
              "hover:bg-primary/90 transition-colors",
              "focus-ring",
            )}
          >
            <Mic className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
});
