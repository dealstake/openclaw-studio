/**
 * Zod schemas for wizard configuration validation.
 *
 * Used by `extractJsonBlock()` at the extraction point in `useWizardInChat`
 * to validate LLM output before passing to `executeWizardCreation()`.
 */
import { z } from "zod";

// ── Skill wizard ───────────────────────────────────────────────────────

export const SkillWizardConfigSchema = z.object({
  name: z.string().min(1, "Skill name is required"),
  description: z.string().min(1, "Skill description is required"),
  commands: z.array(z.string()).optional(),
  prerequisites: z.array(z.string()).optional(),
  skillContent: z.string().min(1, "Skill content is required"),
});

// ── Credential wizard ──────────────────────────────────────────────────

export const CredentialWizardConfigSchema = z.object({
  name: z.string().min(1, "Credential name is required"),
  type: z.string().min(1),
  key: z.string().min(1, "Credential key is required"),
  service: z.string().min(1, "Service name is required"),
  scope: z.string().min(1),
  description: z.string().optional(),
});

// ── Project wizard ─────────────────────────────────────────────────────

export const ProjectWizardConfigSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  slug: z.string().min(1, "Project slug is required"),
  description: z.string().min(1, "Project description is required"),
  priority: z.string().min(1),
  status: z.string().min(1),
  phases: z
    .array(
      z.object({
        name: z.string().min(1),
        tasks: z.array(z.string()),
      }),
    )
    .optional(),
});

// ── Agent wizard ───────────────────────────────────────────────────────

export const AgentWizardConfigSchema = z.object({
  name: z.string().min(1, "Agent name is required"),
  purpose: z.string().optional(),
  roleDescription: z.string().optional(),
  category: z.string().optional(),
});

// ── Persona wizard ─────────────────────────────────────────────────────

export const PersonaWizardConfigSchema = z.object({
  name: z.string().min(1, "Persona name is required"),
  displayName: z.string().optional(),
  category: z.string().optional(),
  roleDescription: z.string().optional(),
});

// ── Lookup by wizard type ──────────────────────────────────────────────

import type { ZodType } from "zod";
import type { WizardType } from "./wizardTypes";

/**
 * Returns the Zod schema for a given wizard type.
 * Used by `useWizardInChat` when calling `extractJsonBlock()`.
 */
export function getWizardSchema(type: WizardType): ZodType | undefined {
  switch (type) {
    case "skill":
      return SkillWizardConfigSchema;
    case "credential":
      return CredentialWizardConfigSchema;
    case "project":
      return ProjectWizardConfigSchema;
    case "agent":
      return AgentWizardConfigSchema;
    case "persona":
      return PersonaWizardConfigSchema;
    default:
      return undefined;
  }
}
