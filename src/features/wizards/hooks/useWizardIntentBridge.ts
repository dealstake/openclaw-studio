/**
 * useWizardIntentBridge — Watches streaming message parts for wizard tool calls.
 *
 * When the agent calls `start_wizard({ intent, context })`, this hook
 * detects it and triggers the appropriate wizard overlay.
 *
 * Must be used alongside useWizardInChat in the same component tree.
 */

import { useEffect, useRef } from "react";
import type { MessagePart } from "@/lib/chat/types";
import type { WizardType } from "@/lib/chat/types";
import { WIZARD_TOOL_NAME, resolveWizardIntent, parseWizardToolArgs } from "../lib/wizardIntentDetector";
import { getDefaultWizardPrompt } from "../lib/wizardPrompts";

interface UseWizardIntentBridgeParams {
  /** Current streaming message parts from the focused agent */
  messageParts: MessagePart[];
  /** Whether a wizard is already active */
  isWizardActive: boolean;
  /** Start a wizard — from useWizardInChat */
  startWizard: (type: WizardType, systemPrompt: string) => void;
  /** Agent ID — used to clear state on agent switch */
  agentId?: string | null;
}

/**
 * Scans streaming tool invocations for `start_wizard` calls.
 * Automatically launches the wizard when detected.
 *
 * De-duplication: tracks seen toolCallIds to prevent re-triggering
 * on subsequent renders with the same parts array.
 */
export function useWizardIntentBridge({
  messageParts,
  isWizardActive,
  startWizard,
  agentId,
}: UseWizardIntentBridgeParams): void {
  // Track which tool call IDs we've already processed
  const processedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Don't trigger if a wizard is already active
    if (isWizardActive) return;

    for (const part of messageParts) {
      if (part.type !== "tool-invocation") continue;
      if (part.name !== WIZARD_TOOL_NAME) continue;
      if (part.phase === "complete" || part.phase === "error") continue;

      // De-duplicate by toolCallId
      const callId = part.toolCallId;
      if (processedRef.current.has(callId)) continue;
      processedRef.current.add(callId);

      // Parse the tool args
      const parsed = parseWizardToolArgs(part.args);
      if (!parsed) continue;

      const wizardType = resolveWizardIntent(parsed.intent);
      if (!wizardType) continue;

      // Build a context-aware system prompt if context was provided
      const basePrompt = getDefaultWizardPrompt(wizardType);
      const contextPrefix = parsed.context
        ? `The user expressed the following intent: "${parsed.context}"\n\nUse this as context for the wizard conversation.\n\n`
        : "";
      const prompt = contextPrefix + basePrompt;

      // Trigger the wizard
      startWizard(wizardType, prompt);
      break; // Only one wizard at a time
    }
  }, [messageParts, isWizardActive, startWizard]);

  // Clean up processed set when parts reset (new run) or agent changes
  useEffect(() => {
    if (messageParts.length === 0) {
      processedRef.current.clear();
    }
  }, [messageParts.length]);

  useEffect(() => {
    processedRef.current.clear();
  }, [agentId]);
}
