import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayClient, GatewayStatus } from "./GatewayClient";
import { toast } from "sonner";

/** A queued chat message waiting for reconnection. */
export type QueuedMessage = {
  id: string;
  agentId: string;
  sessionKey: string;
  message: string;
  attachments?: { mimeType: string; fileName: string; content: string }[];
  queuedAt: number;
};

type SendFn = (
  agentId: string,
  sessionKey: string,
  message: string,
  attachments?: { mimeType: string; fileName: string; content: string }[]
) => Promise<void>;

/**
 * Queues chat messages when the gateway is disconnected and replays them
 * on reconnect. Non-chat destructive actions are blocked entirely.
 */
export function useOfflineQueue(
  client: GatewayClient,
  status: GatewayStatus,
  onSend: SendFn
) {
  const [queue, setQueue] = useState<QueuedMessage[]>([]);
  const prevStatusRef = useRef<GatewayStatus>(status);
  const onSendRef = useRef(onSend);
  const replayingRef = useRef(false);

  useEffect(() => {
    onSendRef.current = onSend;
  }, [onSend]);

  /** Enqueue a message for later delivery. */
  const enqueue = useCallback(
    (
      agentId: string,
      sessionKey: string,
      message: string,
      attachments?: { mimeType: string; fileName: string; content: string }[]
    ) => {
      const entry: QueuedMessage = {
        id: crypto.randomUUID(),
        agentId,
        sessionKey,
        message,
        attachments,
        queuedAt: Date.now(),
      };
      setQueue((prev) => [...prev, entry]);
      toast.info("Message queued — will send when reconnected", { duration: 3000 });
    },
    []
  );

  /** Remove a queued message (e.g., user discards it). */
  const dequeue = useCallback((id: string) => {
    setQueue((prev) => prev.filter((m) => m.id !== id));
  }, []);

  /** Clear entire queue. */
  const clearQueue = useCallback(() => {
    setQueue([]);
  }, []);

  // Replay queue on reconnect
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = status;

    if (status !== "connected" || prev === "connected") return;
    if (replayingRef.current) return;

    setQueue((current) => {
      if (current.length === 0) return current;

      replayingRef.current = true;
      const toReplay = [...current];

      // Fire-and-forget replay — remove each message only after successful send
      (async () => {
        let sent = 0;
        let failed = 0;
        for (const msg of toReplay) {
          try {
            await onSendRef.current(
              msg.agentId,
              msg.sessionKey,
              msg.message,
              msg.attachments
            );
            sent++;
            // Remove only after successful send to prevent data loss
            setQueue((prev) => prev.filter((m) => m.id !== msg.id));
          } catch {
            failed++;
          }
        }
        replayingRef.current = false;
        if (sent > 0) {
          toast.success(
            `${sent} queued message${sent > 1 ? "s" : ""} sent`,
            { duration: 3000 }
          );
        }
        if (failed > 0) {
          toast.error(
            `${failed} queued message${failed > 1 ? "s" : ""} failed — still queued`,
            { duration: 5000 }
          );
        }
      })();

      return current; // Keep queue intact until individual messages succeed
    });
  }, [status]);

  // Discard stale messages (older than 5 minutes)
  useEffect(() => {
    if (queue.length === 0) return;
    const timer = setInterval(() => {
      const cutoff = Date.now() - 5 * 60 * 1000;
      setQueue((prev) => {
        const fresh = prev.filter((m) => m.queuedAt > cutoff);
        const discarded = prev.length - fresh.length;
        if (discarded > 0) {
          toast.warning(
            `${discarded} queued message${discarded > 1 ? "s" : ""} expired (>5 min)`,
            { duration: 4000 }
          );
        }
        return fresh;
      });
    }, 30_000);
    return () => clearInterval(timer);
  }, [queue.length]);

  const isOffline = status !== "connected";

  return {
    queue,
    queueLength: queue.length,
    isOffline,
    enqueue,
    dequeue,
    clearQueue,
  };
}
