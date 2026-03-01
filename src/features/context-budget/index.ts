/**
 * context-budget feature
 *
 * Phase 1: Context Budget Visualization — read-only token cost breakdown.
 * Phase 2: Per-file Context Mode Controls — Always / Auto / Never overrides.
 */

// ── Components ────────────────────────────────────────────────────────────────

export { ContextBudgetCard } from "./components/ContextBudgetCard";
export { ContextProfileEditor } from "./components/ContextProfileEditor";

// ── Hooks ─────────────────────────────────────────────────────────────────────

export { useContextBudget } from "./hooks/useContextBudget";
export { useContextProfile } from "./hooks/useContextProfile";

// ── Service ───────────────────────────────────────────────────────────────────

export {
  parseContextProfile,
  readContextProfileFromSnapshot,
  setContextProfile,
  getEffectiveMode,
  applyModeChange,
} from "./lib/contextProfileService";

// ── Types ─────────────────────────────────────────────────────────────────────

export type {
  BudgetCategory,
  CategoryBudget,
  ContextBudgetData,
  FileBudgetEntry,
  CategoryMeta,
  // Phase 2
  ContextMode,
  ContextProfile,
} from "./types";

export {
  CATEGORY_META,
  BUDGET_CATEGORY_ORDER,
  // Phase 2
  CONTEXT_MODES,
  CONTEXT_MODE_LABELS,
  CONTEXT_MODE_DESCRIPTIONS,
  DEFAULT_CONTEXT_MODE,
} from "./types";
