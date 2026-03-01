/**
 * context-budget feature — Phase 1: Context Budget Visualization
 *
 * Provides a read-only view of estimated token costs for workspace files.
 * No gateway changes required for Phase 1.
 */

export { ContextBudgetCard } from "./components/ContextBudgetCard";
export { useContextBudget } from "./hooks/useContextBudget";
export type {
  BudgetCategory,
  CategoryBudget,
  ContextBudgetData,
  FileBudgetEntry,
  CategoryMeta,
} from "./types";
export { CATEGORY_META, BUDGET_CATEGORY_ORDER } from "./types";
