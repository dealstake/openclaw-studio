/**
 * Guardrails — TypeScript interfaces.
 *
 * Per-agent resource guardrail configuration stored in
 * `config.agents.list[].guardrails` via config.get / config.patch.
 */

/** Action taken when a budget threshold is reached. */
export type ThresholdAction = "warn" | "pause";

/** Threshold trigger rules applied to all budgets on this agent. */
export type BudgetRules = {
  /** Warn action fires at this percentage of any budget (0-100). Default 80. */
  warnThresholdPercent: number;
  /** Action to take when warn threshold is reached. */
  action: ThresholdAction;
};

/**
 * Per-agent guardrail configuration.
 * Stored in config.agents.list[].guardrails.
 * All budget fields are optional — omitted means no limit.
 */
export type GuardrailConfig = {
  /** Whether guardrails are active for this agent. */
  enabled: boolean;
  /** Daily token budget (input + output combined, across all sessions). */
  dailyTokenBudget?: number;
  /** Per-session token budget (input + output combined). */
  perSessionTokenBudget?: number;
  /** Daily cost cap in USD (sum of all session costs for this agent per day). */
  dailyCostCapUsd?: number;
  /** Threshold and action rules applied to all budgets. */
  rules?: BudgetRules;
};

/** Default guardrail config applied when none is stored. */
export const DEFAULT_GUARDRAIL_CONFIG: GuardrailConfig = {
  enabled: false,
};

/** Default threshold rules. */
export const DEFAULT_BUDGET_RULES: BudgetRules = {
  warnThresholdPercent: 80,
  action: "warn",
};

/** Computed status for a single budget limit. */
export type BudgetStatusEntry = {
  /** Current usage value. */
  used: number;
  /** Configured budget limit. */
  limit: number;
  /** Percentage used (0-100, capped at 100). */
  percentUsed: number;
  /** Whether the warn threshold has been reached. */
  isWarning: boolean;
  /** Whether usage has exceeded 100% of the budget. */
  isExceeded: boolean;
};

/** Aggregated runtime budget status for an agent. */
export type AgentBudgetStatus = {
  agentId: string;
  config: GuardrailConfig;
  /** Daily token budget status, present only if dailyTokenBudget is configured. */
  dailyTokens?: BudgetStatusEntry;
  /** Daily cost budget status, present only if dailyCostCapUsd is configured. */
  dailyCost?: BudgetStatusEntry;
  /** Per-session token budget status, present only if perSessionTokenBudget is configured. */
  perSessionTokens?: BudgetStatusEntry;
};
