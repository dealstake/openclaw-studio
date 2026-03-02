"use client";

/**
 * Hook to connect practice sessions to real AI inference via gateway.
 *
 * Creates an isolated gateway session for the practice conversation,
 * sends a system prompt with the persona's role + practice scenario,
 * streams responses back, and handles evaluation.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import type { GatewayClient, EventFrame } from "@/lib/gateway/GatewayClient";
import type { PracticeModeType } from "../lib/personaTypes";

// ── Zod schemas ────────────────────────────────────────────────────────

const AgentEventDataSchema = z.object({
  delta: z.string().optional(),
  text: z.string().optional(),
  phase: z.string().optional(),
});

const EventPayloadSchema = z.object({
  sessionKey: z.string().optional(),
  stream: z.string().optional(),
  state: z.string().optional(),
  role: z.string().optional(),
  errorMessage: z.string().optional(),
  data: AgentEventDataSchema.optional(),
  message: z.unknown().optional(),
});

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
}

export interface UsePracticeChatReturn {
  /** All messages in the practice conversation */
  messages: PracticeChatMessage[];
  /** Current streaming text from the AI */
  streamText: string | null;
  /** Whether the AI is currently responding */
  isStreaming: boolean;
  /** Error if something went wrong */
  error: string | null;
  /** Start the practice session (creates gateway session + sends system prompt) */
  start: () => Promise<void>;
  /** Send a user message */
  send: (text: string) => Promise<void>;
  /** End the session and request evaluation */
  evaluate: () => Promise<void>;
  /** Clean up the session */
  cleanup: () => Promise<void>;
  /** Whether the session has been started */
  isActive: boolean;
  /** Evaluation result text (null until evaluation completes) */
  evaluationText: string | null;
}

// ── System prompts ─────────────────────────────────────────────────────

function buildPracticeSystemPrompt(
  personaName: string,
  mode: PracticeModeType,
  difficulty: "easy" | "medium" | "hard",
): string {
  const difficultyInstructions: Record<string, string> = {
    easy: "Be cooperative, respond positively to most approaches, and give gentle hints when the user struggles.",
    medium: "Be realistic — push back naturally, raise common objections, but remain open to persuasion with good technique.",
    hard: "Be a tough counterpart — skeptical, distracted, raise difficult objections, interrupt occasionally. Only concede to exceptional skill.",
  };

  const modeInstructions: Record<PracticeModeType, string> = {
    "mock-call": `You are role-playing as a potential prospect/lead receiving a phone call from the user. 
    Act as a realistic business owner or decision-maker. React naturally to the caller's pitch, questions, and approach.
    Raise realistic objections. The user is practicing their cold calling skills.`,

    "task-delegation": `You are role-playing as a busy executive delegating tasks to the user (who plays the assistant).
    Give instructions with varying clarity. Sometimes be vague, sometimes specific. 
    The user is practicing their ability to clarify requirements, manage expectations, and execute tasks.`,

    "ticket-simulation": `You are role-playing as a frustrated customer with a technical issue.
    Describe your problem with varying levels of technical accuracy. React emotionally if the support feels unhelpful.
    The user is practicing their support and troubleshooting skills.`,

    "content-review": `You are role-playing as a content manager giving a brief to the user (a content creator).
    Provide creative direction, brand guidelines, and feedback on drafts.
    The user is practicing their content creation and revision skills.`,

    interview: `You are role-playing as a job candidate being interviewed by the user.
    Answer questions with varying quality. Sometimes be evasive, sometimes over-share.
    The user is practicing their interviewing and evaluation skills.`,

    analysis: `You are presenting data and scenarios to the user for analysis.
    Provide information with some ambiguity and hidden insights.
    The user is practicing their analytical and recommendation skills.`,

    scenario: `You are role-playing in an open-ended professional scenario with the user.
    React naturally and create a realistic interaction.
    The user is practicing their professional skills.`,
  };

  return `You are "${personaName}" in a practice/training session. This is a role-play exercise.

## Your Role
${modeInstructions[mode]}

## Difficulty Level: ${difficulty.toUpperCase()}
${difficultyInstructions[difficulty]}

## Rules
- Stay in character at all times
- Keep responses concise and natural (2-4 sentences typical, longer only when realistic)
- DO NOT break character to give tips or feedback during the conversation
- React to the user's actual words and technique, not what they "should" say
- If the conversation reaches a natural endpoint (meeting booked, issue resolved, etc.), acknowledge it in character
- Remember: this is PRACTICE — the user is trying to improve their skills`;
}

// ── Hook ───────────────────────────────────────────────────────────────

export function usePracticeChat({
  client,
  personaId,
  personaName,
  mode,
  difficulty,
}: UsePracticeChatOptions): UsePracticeChatReturn {
  const [messages, setMessages] = useState<PracticeChatMessage[]>([]);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [evaluationText, setEvaluationText] = useState<string | null>(null);

  const sessionKeyRef = useRef<string | null>(null);
  const cleanedUpRef = useRef(false);

  // Generate a stable session key
  const getSessionKey = useCallback(() => {
    if (!sessionKeyRef.current) {
      sessionKeyRef.current = `agent:${personaId}:practice:${Date.now()}`;
    }
    return sessionKeyRef.current;
  }, [personaId]);

  // ── Event subscription ─────────────────────────────────────────────

  useEffect(() => {
    const unsub = client.onEvent((event: EventFrame) => {
      const sk = sessionKeyRef.current;
      if (!sk) return;

      if (event.event !== "chat" && event.event !== "agent") return;

      const payloadParse = EventPayloadSchema.safeParse(event.payload);
      if (!payloadParse.success) return;
      const payload = payloadParse.data;

      if (payload.sessionKey !== sk) return;

      // ── runtime.agent events ──
      if (event.event === "agent") {
        const stream = payload.stream ?? "";
        const data = payload.data ?? {};

        if (stream === "assistant") {
          const delta = data.delta ?? "";
          const text = data.text ?? "";
          if (text) {
            setStreamText(text);
          } else if (delta) {
            setStreamText((prev) => (prev ?? "") + delta);
          }
          setIsStreaming(true);
          return;
        }

        if (stream === "lifecycle") {
          const phase = data.phase ?? "";
          if (phase === "end" || phase === "error") {
            setIsStreaming(false);
          }
        }
        return;
      }

      // ── chat events ──
      const state = payload.state ?? "";
      const role = resolveRole(payload.message);

      if (state === "delta") {
        const text = extractText(payload.message);
        if (typeof text === "string") {
          setStreamText(text);
          setIsStreaming(true);
        }
        return;
      }

      if (state === "final") {
        const text = extractText(payload.message);
        if (role === "assistant" && typeof text === "string") {
          const finalText = text.trim();

          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: finalText,
              timestamp: Date.now(),
            },
          ]);
          setStreamText(null);
          setIsStreaming(false);
        }
        return;
      }

      if (state === "error") {
        setError(payload.errorMessage ?? "An error occurred.");
        setStreamText(null);
        setIsStreaming(false);
        return;
      }

      if (state === "aborted") {
        setStreamText(null);
        setIsStreaming(false);
      }
    });

    return unsub;
  }, [client]);

  // ── Start ──────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    const sk = getSessionKey();
    setError(null);
    cleanedUpRef.current = false;

    try {
      const systemPrompt = buildPracticeSystemPrompt(personaName, mode, difficulty);

      // Send system prompt to initialize the session
      await client.call("chat.send", {
        sessionKey: sk,
        message: `[system] ${systemPrompt}`,
        deliver: false,
        idempotencyKey: crypto.randomUUID(),
      });

      // Send initial message to get the AI to start in character
      await client.call("chat.send", {
        sessionKey: sk,
        message: "[system] The practice session is starting now. Begin the interaction in character. Your opening line should set the scene for the practice scenario.",
        deliver: false,
        idempotencyKey: crypto.randomUUID(),
      });

      setIsActive(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start practice session.");
    }
  }, [client, getSessionKey, personaName, mode, difficulty]);

  // ── Send ───────────────────────────────────────────────────────────

  const send = useCallback(
    async (text: string) => {
      const sk = sessionKeyRef.current;
      if (!sk || !isActive) return;

      setError(null);

      // Add user message immediately
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "user",
          content: text,
          timestamp: Date.now(),
        },
      ]);
      setIsStreaming(true);

      try {
        await client.call("chat.send", {
          sessionKey: sk,
          message: text,
          deliver: false,
          idempotencyKey: crypto.randomUUID(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send message.");
        setIsStreaming(false);
      }
    },
    [client, isActive],
  );

  // ── Evaluate ───────────────────────────────────────────────────────

  const evaluate = useCallback(async () => {
    const sk = sessionKeyRef.current;
    if (!sk) return;

    setIsStreaming(true);

    try {
      // Send evaluation request
      await client.call("chat.send", {
        sessionKey: sk,
        message: `[system] The practice session has ended. Break character now and provide a detailed evaluation of the user's performance. Score them on a scale of 1-10 overall, and provide specific feedback on:

1. **Opening & Rapport** — How well did they open the conversation?
2. **Discovery & Listening** — Did they ask good questions and listen?
3. **Technique** — Did they use effective techniques for this scenario?
4. **Objection Handling** — How well did they handle pushback?
5. **Outcome** — Did they achieve the goal of the interaction?

Format your response with the overall score first, then dimension scores, then specific feedback with examples from the conversation. End with 2-3 actionable improvements.`,
        deliver: false,
        idempotencyKey: crypto.randomUUID(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to request evaluation.");
      setIsStreaming(false);
    }
  }, [client]);

  // ── Cleanup ────────────────────────────────────────────────────────

  const cleanup = useCallback(async () => {
    const sk = sessionKeyRef.current;
    if (!sk || cleanedUpRef.current) return;
    cleanedUpRef.current = true;

    try {
      await client.call("sessions.delete", { key: sk });
    } catch {
      // Ignore cleanup errors
    }

    sessionKeyRef.current = null;
    setMessages([]);
    setStreamText(null);
    setIsStreaming(false);
    setError(null);
    setIsActive(false);
    setEvaluationText(null);
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

// ── Helpers ────────────────────────────────────────────────────────────

function resolveRole(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const role = (message as Record<string, unknown>).role;
  return typeof role === "string" ? role : null;
}

function extractText(message: unknown): string | null {
  if (!message || typeof message !== "object") return null;
  const msg = message as Record<string, unknown>;

  if (typeof msg.text === "string") return msg.text;
  if (typeof msg.content === "string") return msg.content;

  if (Array.isArray(msg.content)) {
    const texts = msg.content
      .filter(
        (part: unknown) =>
          part &&
          typeof part === "object" &&
          (part as Record<string, unknown>).type === "text",
      )
      .map((part: unknown) => (part as Record<string, unknown>).text)
      .filter((t): t is string => typeof t === "string");
    return texts.length > 0 ? texts.join("") : null;
  }

  return null;
}
