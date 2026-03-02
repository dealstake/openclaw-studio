"use client";

/**
 * Hook to connect practice sessions to real AI inference via the gateway.
 *
 * Uses the `agent:bootstrap` hook (`persona-bootstrap`) to swap brain files
 * for the persona, then sends messages via `chat.send` RPC and listens
 * for streaming events on the practice session key.
 *
 * Replaces the old `/api/practice/chat` raw-Gemini approach, giving
 * practice sessions full tool access, streaming, and proper session history.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { EventFrame } from "@/lib/gateway/types";
import type { PracticeModeType } from "../lib/personaTypes";

// ── Types ──────────────────────────────────────────────────────────────

export interface PracticeChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

export interface UsePracticeChatOptions {
  client: GatewayClient;
  personaId: string;
  personaName: string;
  mode: PracticeModeType;
  difficulty: "easy" | "medium" | "hard";
  /** The owning agent ID (defaults to "alex") */
  agentId?: string;
}

export interface UsePracticeChatReturn {
  messages: PracticeChatMessage[];
  streamText: string | null;
  isStreaming: boolean;
  error: string | null;
  /** Start the practice session */
  start: () => Promise<void>;
  /** Send a user message */
  send: (text: string) => Promise<void>;
  /** End the session and request evaluation */
  evaluate: () => Promise<void>;
  /** Clean up the session */
  cleanup: () => void;
  /** Whether the session has been started */
  isActive: boolean;
  /** Evaluation text from the AI */
  evaluationText: string | null;
}

// ── Session key builder ────────────────────────────────────────────────

function buildPracticeSessionKey(agentId: string, personaId: string): string {
  return `agent:${agentId}:practice:${personaId}`;
}

// ── Kickoff prompt ─────────────────────────────────────────────────────

function buildKickoffMessage(
  personaName: string,
  mode: PracticeModeType,
  difficulty: "easy" | "medium" | "hard",
): string {
  const modeLabels: Record<PracticeModeType, string> = {
    "mock-call": "cold call",
    "task-delegation": "task delegation exercise",
    "ticket-simulation": "support ticket simulation",
    "content-review": "content review session",
    interview: "interview",
    analysis: "analysis exercise",
    scenario: "professional scenario",
  };

  return (
    `Start a ${modeLabels[mode]} practice session as "${personaName}". ` +
    `Difficulty: ${difficulty}. ` +
    `Begin the interaction in character with a realistic opening. ` +
    `Do NOT break character or explain — just start the scene.`
  );
}

// ── Payload helpers ────────────────────────────────────────────────────

type EventPayload = Record<string, unknown>;
type EventData = Record<string, unknown>;

function getPayload(event: EventFrame): EventPayload | null {
  return event.payload && typeof event.payload === "object"
    ? (event.payload as EventPayload)
    : null;
}

function getData(payload: EventPayload): EventData | null {
  return payload.data && typeof payload.data === "object"
    ? (payload.data as EventData)
    : null;
}

// ── Hook ───────────────────────────────────────────────────────────────

export function usePracticeChat({
  client,
  personaId,
  personaName,
  mode,
  difficulty,
  agentId = "alex",
}: UsePracticeChatOptions): UsePracticeChatReturn {
  const [messages, setMessages] = useState<PracticeChatMessage[]>([]);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [evaluationText, setEvaluationText] = useState<string | null>(null);

  const sessionKeyRef = useRef<string>("");
  const streamBufferRef = useRef<string>("");
  const unsubscribeRef = useRef<(() => void) | null>(null);
  /** Set when evaluate() is active — the resolve callback for the eval promise */
  const evalResolveRef = useRef<((text: string) => void) | null>(null);

  // ── Event listener ─────────────────────────────────────────────────

  const setupEventListener = useCallback(() => {
    unsubscribeRef.current?.();

    const sessionKey = sessionKeyRef.current;
    if (!sessionKey) return;

    const unsubscribe = client.onEvent((event: EventFrame) => {
      if (event.event !== "agent" && event.event !== "chat") return;

      const payload = getPayload(event);
      if (!payload || payload.sessionKey !== sessionKey) return;

      // ── Agent stream events ──
      if (event.event === "agent") {
        const stream = typeof payload.stream === "string" ? payload.stream : "";
        const data = getData(payload);

        // Text delta
        if (stream === "assistant" && data) {
          const delta = typeof data.delta === "string" ? data.delta : "";
          const text = typeof data.text === "string" ? data.text : "";

          if (text) {
            streamBufferRef.current = text;
          } else if (delta) {
            streamBufferRef.current += delta;
          }
          setStreamText(streamBufferRef.current);
          setIsStreaming(true);
          return;
        }

        // Lifecycle end = turn complete
        if (stream === "lifecycle" && data) {
          const phase = typeof data.phase === "string" ? data.phase : "";

          if (phase === "end" || phase === "error") {
            const finalText = streamBufferRef.current;

            if (phase === "error") {
              const errMsg =
                typeof data.error === "string"
                  ? data.error
                  : "An error occurred during the practice session.";
              setError(errMsg);
            } else if (finalText) {
              // Check if we're in evaluate mode
              if (evalResolveRef.current) {
                evalResolveRef.current(finalText);
                evalResolveRef.current = null;
              } else {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: "assistant",
                    content: finalText,
                    timestamp: Date.now(),
                  },
                ]);
              }
            }

            streamBufferRef.current = "";
            setStreamText(null);
            setIsStreaming(false);
          }
        }
      }
    });

    unsubscribeRef.current = unsubscribe;
  }, [client]);

  // ── Cleanup on unmount ─────────────────────────────────────────────

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.();
    };
  }, []);

  // ── Start ──────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    setError(null);
    setMessages([]);
    setEvaluationText(null);
    streamBufferRef.current = "";

    const sessionKey = buildPracticeSessionKey(agentId, personaId);
    sessionKeyRef.current = sessionKey;

    // Reset any stale session
    try {
      await client.call("chat.abort", { sessionKey });
    } catch {
      // Ignore — session might not exist yet
    }

    setupEventListener();

    try {
      setIsStreaming(true);
      setIsActive(true);

      const kickoff = buildKickoffMessage(personaName, mode, difficulty);

      await client.call("chat.send", {
        sessionKey,
        message: kickoff,
        deliver: false,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start practice session.",
      );
      setIsStreaming(false);
      setIsActive(false);
    }
  }, [
    client,
    agentId,
    personaId,
    personaName,
    mode,
    difficulty,
    setupEventListener,
  ]);

  // ── Send ───────────────────────────────────────────────────────────

  const send = useCallback(
    async (text: string) => {
      if (!isActive || !sessionKeyRef.current) return;
      setError(null);
      streamBufferRef.current = "";

      const userMsg: PracticeChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsStreaming(true);

      try {
        await client.call("chat.send", {
          sessionKey: sessionKeyRef.current,
          message: text,
          deliver: false,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to send message.",
        );
        setIsStreaming(false);
      }
    },
    [client, isActive],
  );

  // ── Evaluate ───────────────────────────────────────────────────────

  const evaluate = useCallback(async () => {
    if (!sessionKeyRef.current || messages.length < 2) return;

    setIsStreaming(true);
    streamBufferRef.current = "";

    try {
      // Set up a promise that resolves when the lifecycle:end event fires
      const evalText = await new Promise<string>((resolve, reject) => {
        evalResolveRef.current = resolve;
        const timeout = setTimeout(() => {
          evalResolveRef.current = null;
          reject(new Error("Evaluation timed out"));
        }, 60_000);

        client
          .call("chat.send", {
            sessionKey: sessionKeyRef.current,
            message: `The practice session is now over. Break character and evaluate my performance:

1. **Score** (1-10): How well did I perform?
2. **Strengths**: What did I do well? (2-3 bullet points)
3. **Areas to Improve**: Where could I improve? (2-3 bullet points)
4. **Key Tip**: One specific, actionable tip for next time.

Be honest but encouraging. Reference specific moments from our conversation.`,
            deliver: false,
          })
          .catch((err: unknown) => {
            clearTimeout(timeout);
            evalResolveRef.current = null;
            reject(err);
          });

        // Clear timeout when resolved
        const origResolve = resolve;
        evalResolveRef.current = (text: string) => {
          clearTimeout(timeout);
          origResolve(text);
        };
      });

      setEvaluationText(evalText);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to evaluate session.",
      );
    } finally {
      setStreamText(null);
      setIsStreaming(false);
    }
  }, [client, messages.length]);

  // ── Cleanup ────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (sessionKeyRef.current) {
      client
        .call("chat.abort", { sessionKey: sessionKeyRef.current })
        .catch(() => {});
    }

    unsubscribeRef.current?.();
    unsubscribeRef.current = null;
    evalResolveRef.current = null;

    setIsActive(false);
    setMessages([]);
    setStreamText(null);
    setIsStreaming(false);
    setError(null);
    setEvaluationText(null);
    streamBufferRef.current = "";
    sessionKeyRef.current = "";
  }, [client]);

  return {
    messages,
    streamText,
    isStreaming,
    error,
    start,
    send,
    evaluate,
    cleanup,
    isActive,
    evaluationText,
  };
}
