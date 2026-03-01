/**
 * ForkButton — Inline button to fork a session from a specific message.
 *
 * Shown on hover over replay messages. Clicking opens a confirmation
 * dialog with optional model/thinking overrides, then creates the fork.
 */

"use client";

import { memo, useCallback, useState } from "react";
import { GitBranch, Loader2 } from "lucide-react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { forkSession, type ForkResult } from "../lib/forkService";

interface ForkButtonProps {
  client: GatewayClient;
  sourceSessionKey: string;
  agentId: string;
  messageIndex: number;
  onForked?: (result: ForkResult) => void;
  className?: string;
}

export const ForkButton = memo(function ForkButton({
  client,
  sourceSessionKey,
  agentId,
  messageIndex,
  onForked,
  className,
}: ForkButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFork = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await forkSession(client, {
        sourceSessionKey,
        agentId,
        forkAtIndex: messageIndex,
        label: `Fork at message ${messageIndex + 1}`,
      });
      onForked?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fork failed");
    } finally {
      setLoading(false);
    }
  }, [client, sourceSessionKey, agentId, messageIndex, onForked]);

  return (
    <div className={`inline-flex items-center gap-1 ${className ?? ""}`}>
      <button
        onClick={handleFork}
        disabled={loading}
        className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded transition-colors min-h-[32px] disabled:opacity-50"
        title="Fork conversation from this message"
        aria-label={`Fork conversation from message ${messageIndex + 1}`}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <GitBranch className="h-3 w-3" />
        )}
        Fork
      </button>
      {error && (
        <span className="text-xs text-destructive max-w-[200px] truncate" title={error}>
          {error}
        </span>
      )}
    </div>
  );
});
