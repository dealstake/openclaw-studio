/**
 * Structured message part types for the chat rendering pipeline.
 *
 * Gateway WebSocket events → parseMessageParts → MessagePart[] → UI components
 *
 * Consumed by:
 * - Main Chat Rebuild (AgentChatPanel replacement)
 * - Unified Wizard Infrastructure (WizardChat)
 * - ChatStatusBar, ThinkingBlock, ToolCallBlock, TokenCostDisplay
 */

// ── Wizard Type ────────────────────────────────────────────────────────

/**
 * Wizard type identifier — defined here (in lib/) so MessagePart can carry
 * wizard context without creating a circular dependency from lib → features.
 *
 * Re-exported by `@/features/wizards/lib/wizardTypes` for feature code to use.
 */
export type WizardType =
  | "task"
  | "agent"
  | "project"
  | "skill"
  | "credential"
  | "persona";

// ── Message Parts ──────────────────────────────────────────────────────

export type TextPart = {
  type: "text";
  text: string;
  streaming?: boolean;
  /**
   * When set, this part originated from a wizard session of the given type.
   * Used for themed rendering when wizard messages are embedded in the main
   * chat transcript (e.g., after wizard completion).
   */
  wizardType?: WizardType;
};

export type ReasoningPart = {
  type: "reasoning";
  text: string;
  startedAt?: number;
  completedAt?: number;
  streaming?: boolean;
  /** Wizard session origin — see TextPart.wizardType */
  wizardType?: WizardType;
};

export type ToolInvocationPhase = "pending" | "running" | "complete" | "error";

export type ToolInvocationPart = {
  type: "tool-invocation";
  toolCallId: string;
  name: string;
  phase: ToolInvocationPhase;
  args?: string;
  result?: string;
  startedAt?: number;
  completedAt?: number;
  /** Wizard session origin — see TextPart.wizardType */
  wizardType?: WizardType;
};

export type ImagePart = {
  type: "image";
  src: string;
  alt?: string;
  /** Wizard session origin — see TextPart.wizardType */
  wizardType?: WizardType;
};

export type StatusPart = {
  type: "status";
  state: string;
  model?: string;
  runStartedAt?: number;
  errorMessage?: string;
  /** Wizard session origin — see TextPart.wizardType */
  wizardType?: WizardType;
};

export type MessagePart =
  | TextPart
  | ReasoningPart
  | ToolInvocationPart
  | ImagePart
  | StatusPart;

// ── Type Guards ────────────────────────────────────────────────────────

export function isTextPart(part: MessagePart): part is TextPart {
  return part.type === "text";
}

export function isReasoningPart(part: MessagePart): part is ReasoningPart {
  return part.type === "reasoning";
}

export function isToolInvocationPart(
  part: MessagePart,
): part is ToolInvocationPart {
  return part.type === "tool-invocation";
}

export function isImagePart(part: MessagePart): part is ImagePart {
  return part.type === "image";
}

export function isStatusPart(part: MessagePart): part is StatusPart {
  return part.type === "status";
}

/**
 * Returns true if this part originated from a wizard session.
 * Useful for filtering wizard content from exports or applying themed rendering.
 */
export function isWizardPart(part: MessagePart): part is MessagePart & { wizardType: WizardType } {
  return part.wizardType !== undefined;
}

// ── Helpers ────────────────────────────────────────────────────────────

/** Filter parts by type with proper narrowing */
export function filterParts<T extends MessagePart["type"]>(
  parts: MessagePart[],
  type: T,
): Extract<MessagePart, { type: T }>[] {
  return parts.filter((p) => p.type === type) as Extract<
    MessagePart,
    { type: T }
  >[];
}
