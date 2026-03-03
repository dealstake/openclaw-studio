/**
 * Core persona types — single source of truth for the entire persona system.
 * All sub-projects (template registry, preflight engine, demo MVP) import from here.
 */

// ---------------------------------------------------------------------------
// Categories & Enums
// ---------------------------------------------------------------------------

/** Top-level persona categories (maps to template browser sections) */
export type PersonaCategory =
  | "sales"
  | "admin"
  | "support"
  | "marketing"
  | "hr"
  | "finance"
  | "legal"
  | "operations";

/** Persona lifecycle status */
export type PersonaStatus =
  | "draft"       // Being built via wizard
  | "configuring" // Preflight in progress (skill/credential setup)
  | "active"      // Deployed and operational
  | "paused"      // Temporarily disabled
  | "archived";   // Soft-deleted

/** Practice mode types — each maps to a specialized prompt + scoring rubric */
export type PracticeModeType =
  | "mock-call"         // Cold Caller, SDR, Account Exec
  | "task-delegation"   // Executive Assistant, Office Admin
  | "ticket-simulation" // IT Help Desk, Customer Service
  | "content-review"    // Content Writer, Email Marketer
  | "interview"         // Recruiter, HR Ops
  | "analysis"          // Financial Analyst, Compliance
  | "scenario";         // Generic catch-all for from-scratch personas

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

/** A single dimension scored during practice */
export interface ScoringDimension {
  /** Machine key, e.g. "objection-handling" */
  key: string;
  /** Human-readable label */
  label: string;
  /** What a 10/10 looks like */
  description: string;
  /** Weight for aggregate score (0–1, dimensions should sum to 1) */
  weight: number;
}

/** Score result for one practice session */
export interface PracticeScore {
  /** ISO timestamp */
  timestamp: string;
  /** Overall score 1–10 */
  overall: number;
  /** Per-dimension scores */
  dimensions: Record<string, number>;
  /** AI-generated feedback summary */
  feedback: string;
  /** Specific improvement suggestions */
  improvements: string[];
}

/** Aggregate metrics across all practice sessions */
export interface PracticeMetrics {
  sessionCount: number;
  averageScore: number;
  bestScore: number;
  /** Score trend: positive = improving */
  trend: number;
  /** Per-dimension averages */
  dimensionAverages: Record<string, number>;
  lastPracticedAt: string | null;
}

// ---------------------------------------------------------------------------
// Skill & Credential Wiring
// ---------------------------------------------------------------------------

/** A capability the persona needs (resolved to skill + credential) */
export interface SkillRequirement {
  /** System skill key (e.g. "gog", "sag", "himalaya") */
  skillKey: string;
  /** Human-readable capability name */
  capability: string;
  /** Whether the persona is usable without this */
  required: boolean;
  /** Credential env var needed (if any) — legacy, prefer credentialTemplateKey */
  credentialKey?: string;
  /** Key into CREDENTIAL_TEMPLATES — used by preflightService for validation */
  credentialTemplateKey?: string;
  /** Human-readable instructions to obtain credential */
  credentialHowTo?: string;
  /**
   * ClawHub package name for auto-install (e.g. "sag", "gog").
   * When present the preflight engine can offer to install the skill from ClawHub.
   */
  clawhubPackage?: string;
  /**
   * MCP servers this capability requires.
   * name — mcporter server name; package — npm package for auto-install;
   * requiredTools — tool names that must be present in the server schema.
   */
  mcpServers?: Array<{
    name: string;
    package?: string;
    requiredTools?: string[];
  }>;
  /**
   * System binary dependencies, keyed by platform package manager.
   * The preflight engine uses whichever key matches the host platform.
   */
  systemDeps?: {
    brew?: string;
    apt?: string;
    winget?: string;
  };
}

// ---------------------------------------------------------------------------
// Brain Files
// ---------------------------------------------------------------------------

/** The set of brain files generated for a persona agent */
export interface PersonaBrainFiles {
  "SOUL.md": string;
  "AGENTS.md": string;
  "IDENTITY.md": string;
  "USER.md": string;
  "PERSONA.md": string;
  "HEARTBEAT.md"?: string;
  "MEMORY.md"?: string;
}

/** Knowledge files written to the agent's knowledge/ directory */
export type KnowledgeFiles = Record<string, string>;

// ---------------------------------------------------------------------------
// Persona Config (core data model)
// ---------------------------------------------------------------------------

/** Full persona configuration — persisted in DB + drives agent creation */
export interface PersonaConfig {
  /** Agent ID (= persona_id, permanent primary key) */
  personaId: string;
  /** User-facing display name */
  displayName: string;
  /** Template key if created from Starter Kit, null if from-scratch */
  templateKey: string | null;
  /** Category for grouping */
  category: PersonaCategory;
  /** Current lifecycle status */
  status: PersonaStatus;
  /** Short role description */
  roleDescription: string;
  /** Company/org this persona serves */
  companyName?: string;
  /** Industry vertical */
  industry?: string;

  /** Practice mode for this persona */
  practiceModeType: PracticeModeType;
  /** Scoring dimensions for practice */
  scoringDimensions: ScoringDimension[];

  /** Skills this persona needs */
  skillRequirements: SkillRequirement[];

  /** Optimization goals set by user (e.g. "book more meetings", "faster resolution") */
  optimizationGoals: string[];

  /** Voice identity for this persona (overrides global/agent voice) */
  voiceConfig?: {
    voiceId: string;
    modelId?: string;
    voiceConfig?: {
      stability?: number;
      similarityBoost?: number;
      style?: number;
      useSpeakerBoost?: boolean;
    };
  } | null;

  /** ISO timestamps */
  createdAt: string;
  lastTrainedAt: string | null;
  practiceCount: number;
}

// ---------------------------------------------------------------------------
// DB Row (mirrors personas table)
// ---------------------------------------------------------------------------

/** Row shape for the personas SQLite table */
export interface PersonaRow {
  persona_id: string;
  display_name: string;
  template_key: string | null;
  category: PersonaCategory;
  status: PersonaStatus;
  optimization_goals: string; // JSON string
  metrics_json: string;       // JSON string (PracticeMetrics)
  created_at: string;
  last_trained_at: string | null;
  practice_count: number;
  // Voice config (Phase 6)
  voice_provider: string | null;
  voice_id: string | null;
  voice_model_id: string | null;
  voice_stability: number;
  voice_clarity: number;
  voice_style: number;
}
