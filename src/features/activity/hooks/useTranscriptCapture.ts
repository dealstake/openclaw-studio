"use client";

import { useCallback, useEffect, useRef } from "react";
import { useLiveActivityStore } from "./useLiveActivityStore";
import { fetchTranscriptMessages } from "@/features/sessions/hooks/useTranscripts";
import { transformMessagesToMessageParts } from "@/features/sessions/lib/transformMessages";

/**
 * Watches the live activity store for cron/subagent sessions that transition
 * to "completed" status. When detected, fetches the full transcript and POSTs
 * enriched data to /api/activity for permanent storage.
 *
 * Must be mounted once in page.tsx.
 */
export function useTranscriptCapture(agentId: string | null) {
  const { sessions } = useLiveActivityStore();
  const capturedRef = useRef(new Set<string>());
  const pendingRef = useRef(new Set<string>());

  const captureTranscript = useCallback(
    async (sessionKey: string, entry: { taskName: string; startedAt: number }) => {
      if (!agentId || pendingRef.current.has(sessionKey)) return;
      pendingRef.current.add(sessionKey);

      try {
        // Extract sessionId from sessionKey (e.g., "agent:alex:cron:abc123" → "abc123")
        const parts = sessionKey.split(":");
        const sessionId = parts[parts.length - 1] ?? sessionKey;

        // Debounce: wait 500ms for session to flush
        await new Promise((r) => setTimeout(r, 500));

        let response = await fetchTranscriptMessages(agentId, sessionId, 0, 200);

        // Retry once if too few messages (session may not be flushed yet)
        if (response.messages.length < 3) {
          await new Promise((r) => setTimeout(r, 2000));
          response = await fetchTranscriptMessages(agentId, sessionId, 0, 200);
        }

        if (response.messages.length === 0) return;

        // Transform to MessageParts for storage
        const messageParts = transformMessagesToMessageParts(response.messages);

        // Compute token totals from message usage
        let tokensIn = 0;
        let tokensOut = 0;
        let model: string | undefined;
        for (const msg of response.messages) {
          if (msg.usage) {
            tokensIn += msg.usage.input ?? 0;
            tokensOut += msg.usage.output ?? 0;
          }
          if (msg.model && !model) model = msg.model;
        }

        const durationMs = Date.now() - entry.startedAt;

        // POST enriched data to /api/activity
        await fetch("/api/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            taskName: entry.taskName || "Agent Run",
            taskId: sessionKey,
            status: "success",
            summary: `Completed ${entry.taskName || "agent run"}`,
            sessionKey,
            transcript: messageParts,
            model: model ?? null,
            tokensIn,
            tokensOut,
            meta: {
              durationMs,
              filesChanged: 0,
              testsCount: 0,
            },
          }),
        });

        capturedRef.current.add(sessionKey);
      } catch (err) {
        console.error("[useTranscriptCapture] Failed to capture transcript", sessionKey, err);
      } finally {
        pendingRef.current.delete(sessionKey);
      }
    },
    [agentId]
  );

  // Watch for completed sessions
  useEffect(() => {
    for (const [key, entry] of sessions) {
      if (
        entry.status === "completed" &&
        !capturedRef.current.has(key) &&
        !pendingRef.current.has(key)
      ) {
        void captureTranscript(key, entry);
      }
    }
  }, [sessions, captureTranscript]);

  // Cleanup on unmount
  useEffect(() => {
    const captured = capturedRef.current;
    const pending = pendingRef.current;
    return () => {
      captured.clear();
      pending.clear();
    };
  }, []);
}
