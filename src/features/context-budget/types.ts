/**
 * Types for the Context Budget feature.
 * Phase 1: Visualization of workspace file token costs.
 */

/** The four categories of workspace files tracked by the budget. */
export type BudgetCategory = "brain" | "memory" | "projects" | "other";

/** A single file entry in the budget breakdown. */
export type FileBudgetEntry = {
  /** File name (basename) */
  name: string;
  /** Relative path within the workspace */
  path: string;
  /** File size in bytes */
  bytes: number;
  /** Estimated token count (bytes / 4) */
  tokens: number;
  /** Category classification */
  category: BudgetCategory;
};

/** Per-category aggregation */
export type CategoryBudget = {
  /** Total estimated tokens for this category */
  tokens: number;
  /** Files in this category */
  files: FileBudgetEntry[];
};

/** Full context budget breakdown */
export type ContextBudgetData = {
  /** Per-category breakdowns */
  categories: Record<BudgetCategory, CategoryBudget>;
  /** Sum of all category token counts */
  totalTokens: number;
  /** Data loading state */
  loading: boolean;
  /** Error message, or null if no error */
  error: string | null;
};

/** Display metadata for each budget category */
export type CategoryMeta = {
  label: string;
  description: string;
  color: string;
};

export const CATEGORY_META: Record<BudgetCategory, CategoryMeta> = {
  brain: {
    label: "Brain Files",
    description: "Core agent identity files (AGENTS.md, SOUL.md, etc.)",
    color: "#6366f1",
  },
  memory: {
    label: "Memory",
    description: "Daily memory logs (memory/YYYY-MM-DD.md)",
    color: "#22c55e",
  },
  projects: {
    label: "Projects",
    description: "Active project files (projects/)",
    color: "#f59e0b",
  },
  other: {
    label: "Other",
    description: "Scripts, references, and other files",
    color: "#94a3b8",
  },
} as const;

/** Ordered list of categories for display */
export const BUDGET_CATEGORY_ORDER: BudgetCategory[] = ["brain", "memory", "projects", "other"];

// ── Phase 2: Per-file context mode controls ───────────────────────────────────

/**
 * Per-file context injection mode.
 *
 * - `always` — always inject this file regardless of gateway smart-selection
 * - `auto`   — gateway decides (default smart context behavior)
 * - `never`  — exclude this file from context injection entirely
 */
export type ContextMode = "always" | "auto" | "never";

/** Map from workspace-relative file path → ContextMode override. Only non-auto entries are stored. */
export type ContextProfile = Record<string, ContextMode>;

export const CONTEXT_MODES: ContextMode[] = ["always", "auto", "never"];

export const CONTEXT_MODE_LABELS: Record<ContextMode, string> = {
  always: "Always",
  auto: "Auto",
  never: "Never",
};

export const CONTEXT_MODE_DESCRIPTIONS: Record<ContextMode, string> = {
  always: "Always inject this file — even if the gateway would skip it",
  auto: "Gateway decides — default smart context behavior",
  never: "Exclude this file from context injection",
};

/** Default context mode for files with no explicit override */
export const DEFAULT_CONTEXT_MODE: ContextMode = "auto";
