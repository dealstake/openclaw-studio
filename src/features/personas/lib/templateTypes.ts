/**
 * Template types — defines Starter Kit structure for the persona template registry.
 * Templates are static packages that provide pre-researched persona scaffolding.
 */

import type {
  PersonaCategory,
  PracticeModeType,
  ScoringDimension,
  SkillRequirement,
} from "./personaTypes";

// ---------------------------------------------------------------------------
// Discovery Phases (used by both template + from-scratch flows)
// ---------------------------------------------------------------------------

/** A single discovery phase in the builder conversation */
export interface DiscoveryPhase {
  /** Phase key, e.g. "company-context" */
  key: string;
  /** Human-readable title shown in progress indicator */
  title: string;
  /** Questions the builder should ask in this phase */
  questions: string[];
  /** Whether web research should trigger during this phase */
  triggerResearch: boolean;
  /** Topics to research if triggered */
  researchTopics?: string[];
}

// ---------------------------------------------------------------------------
// Placeholder Definitions (template customization points)
// ---------------------------------------------------------------------------

/** A placeholder in a template that the user fills during customization */
export interface PlaceholderDef {
  /** Placeholder key, e.g. "company_name", "target_industry" */
  key: string;
  /** Human-readable label */
  label: string;
  /** Prompt text shown to user */
  prompt: string;
  /** Default value (if any) */
  defaultValue?: string;
  /** Validation: "text" | "select" | "multiline" */
  inputType: "text" | "select" | "multiline";
  /** Options for select type */
  options?: string[];
  /** Whether this must be filled before proceeding */
  required: boolean;
}

// ---------------------------------------------------------------------------
// Template Brain File Templates
// ---------------------------------------------------------------------------

/** Brain file template with placeholder tokens like {{company_name}} */
export interface BrainFileTemplate {
  filename: string;
  /** Template content with {{placeholder}} tokens */
  content: string;
}

/** Knowledge file template */
export interface KnowledgeFileTemplate {
  /** Filename within knowledge/ directory */
  filename: string;
  content: string;
}

// ---------------------------------------------------------------------------
// Persona Template (a Starter Kit package)
// ---------------------------------------------------------------------------

/** Complete template definition — everything needed to scaffold a persona */
export interface PersonaTemplate {
  /** Unique template key, e.g. "executive-assistant", "cold-caller" */
  key: string;
  /** Display name */
  name: string;
  /** Short description for template browser */
  description: string;
  /** Longer description shown on template detail view */
  longDescription: string;
  /** Category for grouping */
  category: PersonaCategory;
  /** Icon key (lucide icon name) */
  icon: string;
  /** Tags for search/filtering */
  tags: string[];

  /** Customization placeholders */
  placeholders: PlaceholderDef[];
  /** Discovery phases for guided conversation */
  discoveryPhases: DiscoveryPhase[];

  /** Pre-configured practice mode */
  practiceModeType: PracticeModeType;
  /** Pre-configured scoring dimensions */
  scoringDimensions: ScoringDimension[];

  /** Required skills (checked by preflight engine) */
  skillRequirements: SkillRequirement[];

  /** Brain file templates (with {{placeholder}} tokens) */
  brainFileTemplates: BrainFileTemplate[];
  /** Knowledge file templates */
  knowledgeFileTemplates: KnowledgeFileTemplate[];

  /** Estimated setup time in minutes */
  estimatedSetupMinutes: number;
  /** Difficulty level */
  difficulty: "beginner" | "intermediate" | "advanced";
}

// ---------------------------------------------------------------------------
// Template Registry (the manifest)
// ---------------------------------------------------------------------------

/** Category metadata for the template browser */
export interface TemplateCategory {
  key: PersonaCategory;
  label: string;
  description: string;
  icon: string;
}

/** Template manifest — loaded by the template browser */
export interface TemplateManifest {
  version: string;
  categories: TemplateCategory[];
  templates: PersonaTemplate[];
}
