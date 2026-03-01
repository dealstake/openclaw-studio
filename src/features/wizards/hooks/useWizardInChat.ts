"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GatewayClient, EventFrame } from "@/lib/gateway/GatewayClient";
import type { WizardContext, WizardType, WizardExtractedConfig } from "../lib/wizardTypes";
import { getWizardTheme, getWizardStarters } from "../lib/wizardThemes";
import { extractJsonBlock } from "../lib/artifactExtractor";
import type { PreflightResult } from "@/features/personas/lib/preflightTypes";
import {
  extractWizardToolCall,
  dispatchWizardTool,
} from "../lib/wizardTools";
import { formatPreflightForLLM } from "@/features/personas/lib/preflightPromptHelpers";

// ── Types ──────────────────────────────────────────────────────────────

export type WizardMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  wizardType: WizardType;
  timestamp: number;
};

export type UseWizardInChatOptions = {
  client: GatewayClient;
  agentId: string;
  onConfigExtracted?: (extracted: WizardExtractedConfig) => void;
};

export type UseWizardInChatReturn = {
  /** Active wizard context, null when no wizard running */
  wizardContext: WizardContext | null;
  /** All wizard messages (both user and assistant) */
  messages: WizardMessage[];
  /** Current streaming text from assistant */
  streamText: string | null;
  /** Current thinking/reasoning trace */
  thinkingTrace: string | null;
  /** Whether the wizard session is currently streaming */
  isStreaming: boolean;
  /** Error message if something went wrong */
  error: string | null;
  /** Most recently extracted config (null until extraction succeeds) */
  extractedConfig: WizardExtractedConfig | null;
  /**
   * Most recent preflight result from a run_preflight tool call.
   * Set when the LLM outputs a `json:run_preflight` block and the
   * tool handler completes. Cleared by `clearPreflightResult()`.
   */
  preflightResult: PreflightResult | null;
  /** Clear the current preflight result (e.g. after the UI has handled it) */
  clearPreflightResult: () => void;
  /** Start a wizard session */
  startWizard: (type: WizardType, systemPrompt: string) => void;
  /** Send a message in the active wizard session */
  sendMessage: (text: string) => Promise<void>;
  /** End the active wizard session and clean up */
  endWizard: () => Promise<void>;
  /** Abort the current streaming response */
  abort: () => Promise<void>;
};

// ── Hook ───────────────────────────────────────────────────────────────

/**
 * Manages a wizard lifecycle within the main chat.
 *
 * Creates an isolated gateway session for the wizard conversation,
 * routes messages through it, runs config extraction on assistant
 * responses, and exposes state for rendering inline in the main chat.
 *
 * Unlike `useWizardSession` (used by modals), this hook:
 * - Manages its own WizardContext lifecycle
 * - Tracks messages with IDs and timestamps for main chat rendering
 * - Supports starting/ending wizards dynamically
 * - Stores extracted configs for inline preview cards
 */
export function useWizardInChat({
  client,
  agentId,
  onConfigExtracted,
}: UseWizardInChatOptions): UseWizardInChatReturn {
  const [wizardContext, setWizardContext] = useState<WizardContext | null>(null);
  const [messages, setMessages] = useState<WizardMessage[]>([]);
  const [streamText, setStreamText] = useState<string | null>(null);
  const [thinkingTrace, setThinkingTrace] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedConfig, setExtractedConfig] = useState<WizardExtractedConfig | null>(null);

  const [preflightResult, setPreflightResult] = useState<PreflightResult | null>(null);

  const sessionInitRef = useRef(false);
  const cleanedUpRef = useRef(false);
  const wizardContextRef = useRef<WizardContext | null>(null);
  const onConfigExtractedRef = useRef(onConfigExtracted);
  // Prevent duplicate tool-call processing for the same message
  const pendingToolCallRef = useRef<string | null>(null);
  // Stable ref for agentId — avoids re-registering the event listener on agentId change
  const agentIdRef = useRef(agentId);
  useEffect(() => {
    agentIdRef.current = agentId;
  }, [agentId]);

  // Keep callback ref current
  useEffect(() => {
    onConfigExtractedRef.current = onConfigExtracted;
  }, [onConfigExtracted]);

  // Keep context ref in sync and persist to localStorage for leak cleanup
  useEffect(() => {
    wizardContextRef.current = wizardContext;
    const STORAGE_KEY = `wizard-session:${agentId}`;
    if (wizardContext) {
      try {
        localStorage.setItem(STORAGE_KEY, wizardContext.sessionKey);
      } catch { /* quota exceeded — non-critical */ }
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [wizardContext, agentId]);

  // On mount: clean up any leaked wizard session from a previous page load
  useEffect(() => {
    const STORAGE_KEY = `wizard-session:${agentId}`;
    const leaked = localStorage.getItem(STORAGE_KEY);
    if (leaked) {
      localStorage.removeItem(STORAGE_KEY);
      client.call("sessions.delete", { key: leaked }).catch(() => {});
    }
  }, [agentId, client]);

  // ── Event subscription ─────────────────────────────────────────────

  useEffect(() => {
    const unsub = client.onEvent((event: EventFrame) => {
      const ctx = wizardContextRef.current;
      if (!ctx) return;

      if (event.event !== "runtime.chat" && event.event !== "runtime.agent") return;

      const payload = event.payload as Record<string, unknown> | undefined;
      if (!payload) return;
      if (payload.sessionKey !== ctx.sessionKey) return;

      // ── runtime.agent events ──
      if (event.event === "runtime.agent") {
        const stream = typeof payload.stream === "string" ? payload.stream : "";
        const data =
          payload.data && typeof payload.data === "object"
            ? (payload.data as Record<string, unknown>)
            : null;

        if (stream === "thinking" || stream === "reasoning" || stream === "extended_thinking") {
          const delta = typeof data?.delta === "string" ? data.delta : "";
          const text = typeof data?.text === "string" ? data.text : "";
          if (text) {
            setThinkingTrace(text);
          } else if (delta) {
            setThinkingTrace((prev) => (prev ?? "") + delta);
          }
          setIsStreaming(true);
          return;
        }

        if (stream === "assistant") {
          const delta = typeof data?.delta === "string" ? data.delta : "";
          const text = typeof data?.text === "string" ? data.text : "";
          if (text) {
            setStreamText(text);
          } else if (delta) {
            setStreamText((prev) => (prev ?? "") + delta);
          }
          setIsStreaming(true);
          return;
        }

        if (stream === "lifecycle") {
          const phase = typeof data?.phase === "string" ? data.phase : "";
          if (phase === "end" || phase === "error") {
            setIsStreaming(false);
          }
        }
        return;
      }

      // ── runtime.chat events ──
      const state = typeof payload.state === "string" ? payload.state : "";
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
          const wizardType = ctx.type;

          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: "assistant",
              content: finalText,
              wizardType,
              timestamp: Date.now(),
            },
          ]);
          setStreamText(null);
          setThinkingTrace(null);
          setIsStreaming(false);

          // Config extraction via unified artifact extractor
          const configLabel = `${ctx.extractorType}-config`;
          const config = extractJsonBlock(finalText, configLabel);
          if (config) {
            const extracted: WizardExtractedConfig = {
              type: wizardType,
              config,
              sourceText: finalText,
            };
            setExtractedConfig(extracted);
            onConfigExtractedRef.current?.(extracted);
          }

          // ── Wizard tool call interception ──────────────────────────────
          // Detect `json:run_preflight` (and future tool) blocks in the
          // assistant message. If found: dispatch the tool, inject the
          // result back into the conversation, and update preflightResult
          // so the rendering layer can show a WizardPreflightCard.
          const toolCall = extractWizardToolCall(finalText);
          if (toolCall && pendingToolCallRef.current !== finalText) {
            // Mark this message as processed to prevent re-entrant calls
            pendingToolCallRef.current = finalText;
            const sessionKey = ctx.sessionKey;
            // Use ref to avoid capturing stale agentId in closure
            const currentAgentId = agentIdRef.current;

            void (async () => {
              try {
                const toolResult = await dispatchWizardTool(
                  toolCall.toolName,
                  toolCall.input,
                  currentAgentId,
                );

                if (toolResult.tool === "run_preflight") {
                  // Update the preflight card in the UI
                  setPreflightResult(toolResult.result);

                  // Format the result for the LLM to read
                  const resultText = formatPreflightForLLM(toolResult.result);

                  // Inject back into the wizard session as a system tool-result
                  await client.call("chat.send", {
                    sessionKey,
                    message: `[tool-result:run_preflight]\n${resultText}`,
                    deliver: false,
                    idempotencyKey: crypto.randomUUID(),
                  });
                }
              } catch (err) {
                // Non-fatal — log but don't surface to user (LLM will re-try or continue)
                const msg =
                  err instanceof Error ? err.message : String(err);
                console.warn("[useWizardInChat] tool call failed:", msg);

                // Inject an error notice so the LLM knows to handle gracefully
                try {
                  await client.call("chat.send", {
                    sessionKey,
                    message: `[tool-result:run_preflight]\nPreflight check failed: ${msg}. Please proceed without the check or ask the user to try again.`,
                    deliver: false,
                    idempotencyKey: crypto.randomUUID(),
                  });
                } catch {
                  // Ignore injection failures
                }
              } finally {
                pendingToolCallRef.current = null;
              }
            })();
          }
        }
        return;
      }

      if (state === "error") {
        const errorMsg =
          typeof payload.errorMessage === "string"
            ? payload.errorMessage
            : "An error occurred in the wizard session.";
        setError(errorMsg);
        setStreamText(null);
        setThinkingTrace(null);
        setIsStreaming(false);
        return;
      }

      if (state === "aborted") {
        setStreamText(null);
        setThinkingTrace(null);
        setIsStreaming(false);
      }
    });

    return unsub;
  }, [client]);

  // ── Start wizard ───────────────────────────────────────────────────

  const startWizard = useCallback(
    (type: WizardType, systemPrompt: string) => {
      const sessionKey = `agent:${agentId}:wizard:${type}`;
      const theme = getWizardTheme(type);
      const starters = getWizardStarters(type);

      const ctx: WizardContext = {
        type,
        sessionKey,
        systemPrompt,
        extractorType: type,
        theme,
        starters,
        startedAt: Date.now(),
      };

      // Reset state for new wizard
      setWizardContext(ctx);
      setMessages([]);
      setStreamText(null);
      setThinkingTrace(null);
      setIsStreaming(false);
      setError(null);
      setExtractedConfig(null);
      setPreflightResult(null);
      sessionInitRef.current = false;
      cleanedUpRef.current = false;
      pendingToolCallRef.current = null;
    },
    [agentId],
  );

  // ── Clear preflight result ─────────────────────────────────────────

  const clearPreflightResult = useCallback(() => {
    setPreflightResult(null);
  }, []);

  // ── Send message ───────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      const ctx = wizardContextRef.current;
      if (!ctx) {
        setError("No active wizard session.");
        return;
      }

      setError(null);

      try {
        // Send system prompt on first message
        if (!sessionInitRef.current) {
          sessionInitRef.current = true;
          try {
            await client.call("chat.send", {
              sessionKey: ctx.sessionKey,
              message: `[system] ${ctx.systemPrompt}`,
              deliver: false,
              idempotencyKey: crypto.randomUUID(),
            });
          } catch (err) {
            sessionInitRef.current = false;
            throw err;
          }
        }

        // Add user message to local state
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: "user",
            content: text,
            wizardType: ctx.type,
            timestamp: Date.now(),
          },
        ]);
        setIsStreaming(true);

        await client.call("chat.send", {
          sessionKey: ctx.sessionKey,
          message: text,
          deliver: false,
          idempotencyKey: crypto.randomUUID(),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send wizard message.");
        setIsStreaming(false);
      }
    },
    [client],
  );

  // ── Abort ──────────────────────────────────────────────────────────

  const abort = useCallback(async () => {
    const ctx = wizardContextRef.current;
    if (!ctx) return;
    try {
      await client.call("chat.abort", { sessionKey: ctx.sessionKey });
    } catch {
      // Ignore abort errors
    }
    setIsStreaming(false);
    setStreamText(null);
  }, [client]);

  // ── End wizard ─────────────────────────────────────────────────────

  const endWizard = useCallback(async () => {
    const ctx = wizardContextRef.current;
    if (!ctx) return;
    if (cleanedUpRef.current) return;
    cleanedUpRef.current = true;

    // Clean up the isolated session
    try {
      await client.call("sessions.delete", { key: ctx.sessionKey });
    } catch {
      // Ignore cleanup errors — session may not exist
    }

    setWizardContext(null);
    setMessages([]);
    setStreamText(null);
    setThinkingTrace(null);
    setIsStreaming(false);
    setError(null);
    setExtractedConfig(null);
    setPreflightResult(null);
    sessionInitRef.current = false;
    pendingToolCallRef.current = null;
  }, [client]);

  return {
    wizardContext,
    messages,
    streamText,
    thinkingTrace,
    isStreaming,
    error,
    extractedConfig,
    preflightResult,
    clearPreflightResult,
    startWizard,
    sendMessage,
    endWizard,
    abort,
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
