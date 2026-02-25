"use client";

import { memo } from "react";
import { RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Shared error banner with optional retry button.
 * Used across panels for consistent error display.
 */
export const ErrorBanner = memo(function ErrorBanner({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground",
        className,
      )}
      role="alert"
    >
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button
          type="button"
          className="flex flex-shrink-0 items-center gap-1 rounded px-2 py-1 text-[10px] font-medium transition hover:bg-destructive-foreground/10"
          onClick={onRetry}
          aria-label="Retry"
        >
          <RotateCcw className="h-3 w-3" />
          Retry
        </button>
      )}
    </div>
  );
});
