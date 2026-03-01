/**
 * Template Registry — lookup helpers for persona Starter Kit templates.
 *
 * Templates are compiled into a static array by `scripts/build-templates.ts`.
 * This module is the single import point for all consumer code.
 *
 * Usage:
 *   import { listTemplates, getTemplate } from "@/features/personas/lib/templateRegistry";
 */

import type { PersonaCategory } from "./personaTypes";
import type { PersonaTemplate, TemplateCategory } from "./templateTypes";
import { PERSONA_TEMPLATES } from "./generatedTemplates";

// ---------------------------------------------------------------------------
// Category metadata (source of truth — not derived from templates)
// ---------------------------------------------------------------------------

const CATEGORIES: TemplateCategory[] = [
  {
    key: "sales",
    label: "Sales & Revenue",
    description: "Personas that drive revenue through outreach, calls, and deal management",
    icon: "phone-outgoing",
  },
  {
    key: "admin",
    label: "Executive & Administrative",
    description: "Personas that handle scheduling, email triage, and executive support",
    icon: "calendar-check",
  },
  {
    key: "support",
    label: "Customer Support",
    description: "Personas that resolve tickets and manage customer relationships",
    icon: "headset",
  },
  {
    key: "marketing",
    label: "Marketing & Content",
    description: "Personas that create content, manage campaigns, and drive engagement",
    icon: "megaphone",
  },
  {
    key: "hr",
    label: "People & HR",
    description: "Personas for recruiting, onboarding, and employee experience",
    icon: "users",
  },
  {
    key: "finance",
    label: "Finance & Compliance",
    description: "Personas for financial analysis, reporting, and regulatory compliance",
    icon: "landmark",
  },
  {
    key: "legal",
    label: "Legal",
    description: "Personas for contract review, compliance monitoring, and legal research",
    icon: "scale",
  },
  {
    key: "operations",
    label: "Operations",
    description: "Personas for process management, logistics, and operational efficiency",
    icon: "settings",
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers (project-spec API)
// ---------------------------------------------------------------------------

/** List all templates, optionally filtered by category. */
export function listTemplates(category?: PersonaCategory): PersonaTemplate[] {
  if (!category) return PERSONA_TEMPLATES;
  return PERSONA_TEMPLATES.filter((t) => t.category === category);
}

/** Get a single template by key. Returns undefined if not found. */
export function getTemplate(key: string): PersonaTemplate | undefined {
  return PERSONA_TEMPLATES.find((t) => t.key === key);
}

/** Get all templates in a given category (alias for listTemplates with required arg). */
export function getTemplatesByCategory(category: PersonaCategory): PersonaTemplate[] {
  return PERSONA_TEMPLATES.filter((t) => t.category === category);
}

/** List all defined category keys (including those with no templates yet). */
export function listCategories(): PersonaCategory[] {
  return CATEGORIES.map((c) => c.key);
}

// ---------------------------------------------------------------------------
// Extended helpers (used by TemplateBrowserModal and other UI)
// ---------------------------------------------------------------------------

/** Get full category metadata for all defined categories. */
export function getCategories(): TemplateCategory[] {
  return CATEGORIES;
}

/** Get category metadata for categories that have at least one template. */
export function getActiveCategories(): TemplateCategory[] {
  const activeKeys = new Set(PERSONA_TEMPLATES.map((t) => t.category));
  return CATEGORIES.filter((c) => activeKeys.has(c.key));
}

/** Total number of registered templates. */
export function getTemplateCount(): number {
  return PERSONA_TEMPLATES.length;
}
