/**
 * Shared types for the unified wizard-in-chat system.
 *
 * Wizard sessions run in isolated gateway sessions but render inline
 * in the main chat transcript with themed visual treatment.
 */

// ── Wizard Types ───────────────────────────────────────────────────────

export type WizardType = "task" | "agent" | "project" | "skill" | "credential";

export type WizardStarter = {
  label: string;
  message: string;
};

export type WizardTheme = {
  /** Tailwind text color class for accent elements */
  accent: string;
  /** Tailwind bg color class for subtle backgrounds */
  bg: string;
  /** Tailwind border color class for left-border on messages */
  border: string;
  /** Human-readable label shown in the wizard banner */
  label: string;
  /** Lucide icon name */
  icon: string;
};

/**
 * Active wizard context — stored in AgentState when a wizard is running.
 * `null` when no wizard is active.
 */
export type WizardContext = {
  type: WizardType;
  /** Isolated gateway session key for this wizard conversation */
  sessionKey: string;
  /** System prompt sent on first message */
  systemPrompt: string;
  /** Config extractor type for parsing assistant responses */
  extractorType: WizardType;
  /** Visual theme for this wizard type */
  theme: WizardTheme;
  /** Optional conversation starters shown in the composer */
  starters?: WizardStarter[];
  /** Timestamp when the wizard was started */
  startedAt: number;
};

/**
 * Extracted configuration from a wizard conversation.
 * The `config` shape varies by wizard type.
 */
export type WizardExtractedConfig = {
  type: WizardType;
  config: unknown;
  /** Raw text that contained the config block */
  sourceText: string;
};
