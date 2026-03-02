"use client";

/**
 * Hook to connect practice sessions to real AI inference via `/api/practice/chat`.
 *
 * Maintains conversation state client-side and sends the full history
 * with each request. Uses Gemini via the practice API route for cheap,
 * fast practice conversations.
 */

import { useCallback, useRef, useState } from "react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
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

// ── API call helper ────────────────────────────────────────────────────

interface ApiMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

async function callPracticeApi(
  systemPrompt: string,
  messages: ApiMessage[],
): Promise<string> {
  const res = await fetch("/api/practice/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt, messages }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Practice API error (${res.status})`);
  }

  const data = (await res.json()) as { text: string };
  return data.text;
}

// ── Hook ───────────────────────────────────────────────────────────────

export function usePracticeChat({
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

  const systemPromptRef = useRef<string>("");
  const historyRef = useRef<ApiMessage[]>([]);

  // ── Start ──────────────────────────────────────────────────────────

  const start = useCallback(async () => {
    setError(null);
    setMessages([]);
    setEvaluationText(null);
    historyRef.current = [];

    const systemPrompt = buildPracticeSystemPrompt(personaName, mode, difficulty);
    systemPromptRef.current = systemPrompt;

    try {
      setIsStreaming(true);

      // Send a kick-off message to get the AI to start the scene
      const kickoff: ApiMessage = {
        role: "user",
        content:
          "The practice session is starting now. Begin the interaction in character. Your opening line should set the scene for the practice scenario. Do NOT break character.",
      };

      const response = await callPracticeApi(systemPrompt, [kickoff]);

      // Don't add the kickoff to visible history — just the response
      historyRef.current = [kickoff, { role: "assistant", content: response }];

      setMessages([
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response,
          timestamp: Date.now(),
        },
      ]);
      setIsActive(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start practice session.",
      );
    } finally {
      setStreamText(null);
      setIsStreaming(false);
    }
  }, [personaName, mode, difficulty]);

  // ── Send ───────────────────────────────────────────────────────────

  const send = useCallback(
    async (text: string) => {
      if (!isActive) return;
      setError(null);

      const userMsg: PracticeChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      historyRef.current.push({ role: "user", content: text });
      setIsStreaming(true);
      setStreamText("Thinking…");

      try {
        const response = await callPracticeApi(
          systemPromptRef.current,
          historyRef.current,
        );

        historyRef.current.push({ role: "assistant", content: response });

        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: response,
            timestamp: Date.now(),
          },
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to send message.",
        );
      } finally {
        setStreamText(null);
        setIsStreaming(false);
      }
    },
    [isActive],
  );

  // ── Evaluate ───────────────────────────────────────────────────────

  const evaluate = useCallback(async () => {
    if (historyRef.current.length < 2) return;

    setIsStreaming(true);
    setStreamText("Evaluating…");

    try {
      const evalPrompt = `You just finished a practice/training session with the user. 
Now break character and provide a brief evaluation:

1. **Score** (1-10): How well did the user perform?
2. **Strengths**: What did they do well? (2-3 bullet points)
3. **Areas to Improve**: Where could they improve? (2-3 bullet points)
4. **Key Tip**: One specific, actionable tip for next time.

Be honest but encouraging. Reference specific moments from the conversation.`;

      const evalHistory: ApiMessage[] = [
        ...historyRef.current,
        { role: "user", content: evalPrompt },
      ];

      const response = await callPracticeApi(
        systemPromptRef.current,
        evalHistory,
      );
      setEvaluationText(response);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to evaluate session.",
      );
    } finally {
      setStreamText(null);
      setIsStreaming(false);
    }
  }, []);

  // ── Cleanup ────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    setIsActive(false);
    setMessages([]);
    setStreamText(null);
    setIsStreaming(false);
    setError(null);
    setEvaluationText(null);
    historyRef.current = [];
    systemPromptRef.current = "";
  }, []);

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
