/**
 * Document Templates — Handlebars rendering engine for persona document generation.
 *
 * Provides template rendering with built-in helpers and template discovery
 * from the persona template registry. This module is server-safe and has no
 * React dependencies — import from API routes or server components freely.
 *
 * Built-in helpers available in all templates:
 *   {{formatDate date "long"}}     → "March 3, 2026"
 *   {{formatDate date "short"}}    → "3/3/26"
 *   {{formatDate date "iso"}}      → "2026-03-03"
 *   {{formatDate date "time"}}     → "2:30 PM"
 *   {{currency amount "USD"}}      → "$12,500.00"
 *   {{list items}}                 → "- Item 1\n- Item 2"
 *   {{uppercase value}}            → "ACME CORP"
 *   {{lowercase value}}            → "acme corp"
 *   {{truncate value 100}}         → "Long string…"
 *   {{#if condition}} ... {{/if}}  (built-in Handlebars)
 *   {{#each array}} ... {{/each}}  (built-in Handlebars)
 *
 * Usage:
 *   import { renderTemplate, listDocTemplates, renderDocTemplate } from
 *     "@/features/personas/lib/documentTemplates";
 *
 *   // Render arbitrary template content
 *   const md = renderTemplate("Hello, {{client_name}}!", { client_name: "Acme" });
 *
 *   // List templates for a persona
 *   const templates = listDocTemplates("executive-assistant");
 *
 *   // Render a named template
 *   const brief = renderDocTemplate("executive-assistant", "meeting-brief.md.hbs", data);
 */

import Handlebars from "handlebars";

import type { DocTemplate } from "./templateTypes";
import { getTemplate } from "./templateRegistry";

// ---------------------------------------------------------------------------
// Built-in Helpers
// ---------------------------------------------------------------------------

/**
 * {{formatDate value format}}
 *
 * Formats a Date object or ISO date string.
 * Supported formats: "short" | "long" | "iso" | "time"
 *
 * @example
 *   {{formatDate meetingDate "long"}}   → "March 3, 2026"
 *   {{formatDate meetingDate "short"}}  → "3/3/26"
 *   {{formatDate meetingDate "iso"}}    → "2026-03-03"
 *   {{formatDate meetingDate "time"}}   → "2:30 PM"
 */
Handlebars.registerHelper("formatDate", (value: unknown, format: unknown): string => {
  const date = value instanceof Date ? value : new Date(String(value ?? ""));
  if (isNaN(date.getTime())) return String(value ?? "");

  const fmt = typeof format === "string" ? format : "long";
  switch (fmt) {
    case "short":
      return date.toLocaleDateString("en-US", { dateStyle: "short" });
    case "long":
      return date.toLocaleDateString("en-US", { dateStyle: "long" });
    case "iso":
      return date.toISOString().split("T")[0] ?? "";
    case "time":
      return date.toLocaleTimeString("en-US", { timeStyle: "short" });
    default:
      return date.toLocaleDateString("en-US", { dateStyle: "long" });
  }
});

/**
 * {{currency amount currencyCode}}
 *
 * Formats a numeric value as a locale currency string.
 *
 * @example
 *   {{currency budget "USD"}}  → "$12,500.00"
 *   {{currency fee "EUR"}}     → "€12,500.00"
 */
Handlebars.registerHelper("currency", (amount: unknown, currencyCode: unknown): string => {
  const num = Number(amount);
  if (isNaN(num)) return String(amount ?? "");
  const code =
    typeof currencyCode === "string" && /^[A-Z]{3}$/.test(currencyCode) ? currencyCode : "USD";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(num);
});

/**
 * {{list items}}
 *
 * Renders an array as a Markdown bullet list. Non-array values are passed through.
 *
 * @example
 *   {{list attendees}}  → "- Alice\n- Bob\n- Carol"
 */
Handlebars.registerHelper("list", (items: unknown): Handlebars.SafeString => {
  if (!Array.isArray(items)) return new Handlebars.SafeString(String(items ?? ""));
  const md = (items as unknown[]).map((item) => `- ${String(item)}`).join("\n");
  return new Handlebars.SafeString(md);
});

/**
 * {{uppercase value}}
 *
 * Converts a string to UPPERCASE.
 */
Handlebars.registerHelper("uppercase", (value: unknown): string =>
  String(value ?? "").toUpperCase(),
);

/**
 * {{lowercase value}}
 *
 * Converts a string to lowercase.
 */
Handlebars.registerHelper("lowercase", (value: unknown): string =>
  String(value ?? "").toLowerCase(),
);

/**
 * {{truncate value length}}
 *
 * Truncates a string to `length` characters, appending "…" if truncated.
 *
 * @example
 *   {{truncate summary 120}}  → "First 120 chars of a longer…"
 */
Handlebars.registerHelper("truncate", (value: unknown, length: unknown): string => {
  const str = String(value ?? "");
  const len = typeof length === "number" ? length : parseInt(String(length ?? ""), 10);
  if (isNaN(len) || str.length <= len) return str;
  return str.slice(0, len) + "…";
});

// ---------------------------------------------------------------------------
// Core Rendering
// ---------------------------------------------------------------------------

/**
 * Compile and render a Handlebars template string with the provided data.
 *
 * Uses `noEscape: true` so Markdown content (e.g. `**bold**`, `# Header`) is
 * passed through verbatim — no HTML entity encoding.
 *
 * @param templateContent - Handlebars template string (Markdown with {{tokens}})
 * @param data            - Variables to inject into the template
 * @returns               - Rendered Markdown string ready for PDF/DOCX conversion
 *
 * @example
 *   renderTemplate("# Brief for {{client_name}}\n\nDate: {{formatDate date 'long'}}", {
 *     client_name: "Acme Corp",
 *     date: new Date(),
 *   });
 */
export function renderTemplate(
  templateContent: string,
  data: Record<string, unknown>,
): string {
  const compiled = Handlebars.compile(templateContent, { noEscape: true });
  return compiled(data);
}

// ---------------------------------------------------------------------------
// Template Discovery
// ---------------------------------------------------------------------------

/**
 * List all document templates available for a given persona template key.
 *
 * Templates come from the `documentTemplates` field of the compiled persona
 * template registry. Returns an empty array if the persona is unknown or has
 * no document templates.
 *
 * @param personaTemplateKey - e.g. "executive-assistant", "cold-caller"
 * @returns Array of DocTemplate definitions
 *
 * @example
 *   const templates = listDocTemplates("executive-assistant");
 *   // → [{ filename: "meeting-brief.md.hbs", label: "Meeting Brief", ... }, ...]
 */
export function listDocTemplates(personaTemplateKey: string): DocTemplate[] {
  const personaTemplate = getTemplate(personaTemplateKey);
  return personaTemplate?.documentTemplates ?? [];
}

/**
 * Retrieve a single document template by filename from a persona's template set.
 *
 * @param personaTemplateKey - The persona template key, e.g. "executive-assistant"
 * @param filename           - The template filename, e.g. "meeting-brief.md.hbs"
 * @returns The matching DocTemplate, or undefined if not found
 *
 * @example
 *   const tpl = getDocTemplate("executive-assistant", "meeting-brief.md.hbs");
 */
export function getDocTemplate(
  personaTemplateKey: string,
  filename: string,
): DocTemplate | undefined {
  return listDocTemplates(personaTemplateKey).find((t) => t.filename === filename);
}

/**
 * Render a named document template from a persona's template set.
 *
 * Convenience wrapper: `getDocTemplate` + `renderTemplate` in one call.
 *
 * @param personaTemplateKey - The persona template key
 * @param filename           - The template filename to render
 * @param data               - Variables to inject into the template
 * @returns Rendered Markdown string, or `null` if the template is not found
 *
 * @example
 *   const md = renderDocTemplate("executive-assistant", "meeting-brief.md.hbs", {
 *     meeting_title: "Q1 Planning",
 *     date: new Date(),
 *     attendees: ["Alice", "Bob"],
 *     agenda: ["Review OKRs", "Budget approval"],
 *   });
 */
export function renderDocTemplate(
  personaTemplateKey: string,
  filename: string,
  data: Record<string, unknown>,
): string | null {
  const template = getDocTemplate(personaTemplateKey, filename);
  if (!template) return null;
  return renderTemplate(template.content, data);
}
