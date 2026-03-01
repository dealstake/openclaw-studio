/**
 * Template Registry — in-memory store for persona Starter Kit templates.
 * Templates register at import time via `registerTemplate()`.
 */

import type { PersonaCategory } from "./personaTypes";
import type { PersonaTemplate, TemplateCategory } from "./templateTypes";

// ---------------------------------------------------------------------------
// Internal store
// ---------------------------------------------------------------------------

const templates = new Map<string, PersonaTemplate>();

const categories: TemplateCategory[] = [
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
// Public API
// ---------------------------------------------------------------------------

/** Register a template in the registry. Throws on duplicate key. */
export function registerTemplate(template: PersonaTemplate): void {
  if (templates.has(template.key)) {
    throw new Error(`Template "${template.key}" is already registered`);
  }
  templates.set(template.key, template);
}

/** Get a single template by key. Returns undefined if not found. */
export function getTemplate(key: string): PersonaTemplate | undefined {
  return templates.get(key);
}

/** List all registered templates, optionally filtered by category. */
export function listTemplates(category?: PersonaCategory): PersonaTemplate[] {
  const all = Array.from(templates.values());
  if (!category) return all;
  return all.filter((t) => t.category === category);
}

/** Get all defined categories (including those with no templates yet). */
export function getCategories(): TemplateCategory[] {
  return categories;
}

/** Get categories that have at least one registered template. */
export function getActiveCategories(): TemplateCategory[] {
  const activeKeys = new Set(Array.from(templates.values()).map((t) => t.category));
  return categories.filter((c) => activeKeys.has(c.key));
}

/** Get template count. */
export function getTemplateCount(): number {
  return templates.size;
}
