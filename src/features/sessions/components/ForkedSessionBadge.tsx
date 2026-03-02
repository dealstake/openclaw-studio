/**
 * ForkedSessionBadge — Visual indicator showing fork relationship.
 *
 * Displays a small badge with the fork icon and parent session link.
 */

"use client";

import { memo } from "react";
import { GitBranch } from "lucide-react";
import type { ForkMetadata } from "../lib/forkService";

interface ForkedSessionBadgeProps {
  metadata: ForkMetadata;
  onNavigateToSource?: (sessionKey: string) => void;
  className?: string;
}

export const ForkedSessionBadge = memo(function ForkedSessionBadge({
  metadata,
  onNavigateToSource,
  className,
}: ForkedSessionBadgeProps) {
  const timeAgo = formatTimeAgo(metadata.createdAt);
  const sourceLabel = metadata.sourceSessionKey.split(":").slice(-1)[0]?.slice(0, 8) ?? "source";

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs bg-violet-500/25 text-violet-200 border border-violet-500/40 ${className ?? ""}`}
    >
      <GitBranch className="h-3 w-3" />
      <span>Forked from</span>
      {onNavigateToSource ? (
        <button
          onClick={() => onNavigateToSource(metadata.sourceSessionKey)}
          className="font-mono hover:underline"
        >
          {sourceLabel}
        </button>
      ) : (
        <span className="font-mono">{sourceLabel}</span>
      )}
      <span className="text-muted-foreground">
        at msg {metadata.forkAtIndex + 1}
      </span>
      {metadata.model && (
        <span className="text-muted-foreground">
          → {metadata.model.split("/")[1]}
        </span>
      )}
      <span className="text-muted-foreground">{timeAgo}</span>
    </div>
  );
});

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
