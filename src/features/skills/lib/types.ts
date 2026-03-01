/** Source of skill installation */
export type SkillSource = "bundled" | "managed" | "workspace" | "extra";

/** Environment variable requirement */
export interface SkillEnvRequirement {
  key: string;
  description?: string;
  required: boolean;
  hasValue: boolean;
}

/** Individual skill from skills.status response */
export interface Skill {
  /** Unique key (e.g., "weather", "github", "coding-agent") */
  key: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Source of installation */
  source: SkillSource;
  /** Whether skill is enabled */
  enabled: boolean;
  /** Whether skill is blocked (missing deps or config) */
  blocked: boolean;
  /** Reason for blocking (human-readable) */
  blockReason?: string;
  /** Whether skill has an API key configured */
  hasApiKey: boolean;
  /** Masked API key if configured (e.g., "••••••abc") */
  apiKeyMasked?: string;
  /** Required environment variables */
  envRequirements: SkillEnvRequirement[];
  /** Missing dependencies */
  missingDeps: string[];
  /** Skill file path on disk */
  location?: string;
  /** ClawHub package name if installed from marketplace */
  packageName?: string;
}

/** Full skills report from skills.status RPC */
export interface SkillsReport {
  skills: Skill[];
  /** Total count */
  total: number;
  /** Count by source */
  bySource: Record<SkillSource, number>;
}

/** Skill status for filtering */
export type SkillStatusFilter = "all" | "ready" | "blocked" | "disabled";
