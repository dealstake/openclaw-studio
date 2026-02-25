import { useEffect } from "react";

/**
 * Shared effect for the awaiting-restart → sawDisconnect → finalize pattern.
 *
 * All config mutations (create/delete/rename) follow the same lifecycle:
 * 1. Gateway disconnects after config change
 * 2. We mark `sawDisconnect = true`
 * 3. Gateway reconnects
 * 4. We run `onFinalize` and clear the block state
 *
 * This hook also handles the 90s timeout safety net.
 */

export interface RestartBlockBase {
  phase: string;
  startedAt: number;
  sawDisconnect: boolean;
}

export function useRestartAwaitEffect<T extends RestartBlockBase>(params: {
  block: T | null;
  setBlock: React.Dispatch<React.SetStateAction<T | null>>;
  status: string;
  onFinalize: (block: T) => Promise<void>;
  timeoutMessage: string;
  setError: (error: string) => void;
}): void {
  const { block, setBlock, status, onFinalize, timeoutMessage, setError } = params;

  // Awaiting-restart: track disconnect then finalize on reconnect
  useEffect(() => {
    if (!block || block.phase !== "awaiting-restart") return;
    if (status !== "connected") {
      if (!block.sawDisconnect) {
        setBlock((current) => {
          if (!current || current.phase !== "awaiting-restart" || current.sawDisconnect) return current;
          return { ...current, sawDisconnect: true };
        });
      }
      return;
    }
    if (!block.sawDisconnect) return;
    let cancelled = false;
    const run = async () => {
      await onFinalize(block);
      if (cancelled) return;
      setBlock(null);
    };
    void run();
    return () => { cancelled = true; };
  }, [block, onFinalize, setBlock, status]);

  // Timeout safety net
  useEffect(() => {
    if (!block) return;
    if (block.phase === "queued") return;
    const maxWaitMs = 90_000;
    const elapsed = Date.now() - block.startedAt;
    const remaining = Math.max(0, maxWaitMs - elapsed);
    const timeoutId = window.setTimeout(() => {
      setBlock(null);
      setError(timeoutMessage);
    }, remaining);
    return () => { window.clearTimeout(timeoutId); };
  }, [block, setBlock, setError, timeoutMessage]);
}
