"use client";

/**
 * ApiKeyMissingBanner — Shown inside voice mode overlay when
 * ElevenLabs API key is not configured. Directs user to Credentials panel.
 */

import React from "react";
import { Key } from "lucide-react";
import { cn } from "@/lib/utils";

interface ApiKeyMissingBannerProps {
  /** Callback to navigate user to credentials panel */
  onNavigateToCredentials?: (() => void) | null;
}

export const ApiKeyMissingBanner = React.memo(function ApiKeyMissingBanner({
  onNavigateToCredentials,
}: ApiKeyMissingBannerProps) {
  return (
    <div
      className={cn(
        "mx-4 max-w-md rounded-xl border border-amber-500/20 bg-amber-500/5 p-4",
        "flex flex-col items-center gap-3 text-center",
      )}
      role="alert"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/10">
        <Key className="h-5 w-5 text-amber-500" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">
          ElevenLabs API Key Required
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add your ElevenLabs API key in Settings → Credentials to enable voice mode.
        </p>
      </div>
      {onNavigateToCredentials && (
        <button
          type="button"
          onClick={onNavigateToCredentials}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium",
            "bg-primary text-primary-foreground",
            "hover:bg-primary/90 transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          Open Credentials
        </button>
      )}
    </div>
  );
});
