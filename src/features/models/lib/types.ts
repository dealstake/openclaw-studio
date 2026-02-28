/**
 * Models & Brains — Type definitions.
 *
 * Covers primary brain, specialist engines (Gemini, OpenAI, etc.),
 * model catalog, and advanced role assignments.
 */

// ── Engine Types ─────────────────────────────────────────────────────────────

/** Available specialist engine types (extensible) */
export type EngineType = "gemini" | "openai" | "anthropic" | "mistral";

/** Registry entry for an available engine type (static template) */
export interface EngineTemplate {
  type: EngineType;
  displayName: string;
  icon: string;
  description: string;
  bestFor: string;
  primaryEnvKey: string;
  helpUrl: string;
  defaultModel: string;
  defaultFallback: string;
  availableModels: string[];
}

/** Configured specialist engine (derived from skills.entries + env.vars) */
export interface SpecialistEngine {
  type: EngineType;
  configKey: string;
  displayName: string;
  enabled: boolean;
  hasApiKey: boolean;
  maskedApiKey: string;
  model: string;
  fallbackModel: string | null;
  purpose: string;
}

// ── Brain Model Types ────────────────────────────────────────────────────────

/** Brain model configuration (primary + fallbacks) */
export interface BrainModelConfig {
  primary: string | null;
  primaryName: string;
  fallbacks: string[];
  fallbackNames: string[];
}

// ── Model Catalog Types ──────────────────────────────────────────────────────

/** Model info from gateway catalog */
export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  fullKey: string;
  contextWindow?: number;
  reasoning?: boolean;
  alias?: string;
  isConfigured: boolean;
  isDefault: boolean;
  isFallback: boolean;
}

/** Provider summary for the "View all models" expandable */
export interface ProviderSummary {
  name: string;
  displayName: string;
  modelCount: number;
  configuredCount: number;
  models: ModelInfo[];
}

// ── Advanced Configuration Types ─────────────────────────────────────────────

/** Cron job model override */
export interface CronModelOverride {
  cronId: string;
  cronName: string;
  model: string | null;
  modelName: string;
}

/** Advanced: model role assignments */
export interface ModelRoles {
  subagentModel: string | null;
  subagentModelName: string;
  subagentThinking: string | null;
  heartbeatModel: string | null;
  heartbeatModelName: string;
  cronOverrides: CronModelOverride[];
}

// ── Auth Profile Types ───────────────────────────────────────────────────────

/** Usage stats for an auth profile */
export interface AuthProfileUsage {
  lastUsed?: number;
  errorCount?: number;
  lastFailureAt?: number;
}

/** Auth profile as returned by the API (masked, never exposes full token) */
export interface AuthProfileInfo {
  id: string;
  provider: string;
  type: string;
  maskedToken: string;
  disabledUntil: number | null;
  cooldownUntil: number | null;
  isLastGood: boolean;
  usage: AuthProfileUsage | null;
}

// ── Aggregate ────────────────────────────────────────────────────────────────

/** Full models data returned by the hook */
export interface ModelsData {
  brainConfig: BrainModelConfig;
  engines: SpecialistEngine[];
  roles: ModelRoles;
  providers: ProviderSummary[];
  allModels: ModelInfo[];
}
