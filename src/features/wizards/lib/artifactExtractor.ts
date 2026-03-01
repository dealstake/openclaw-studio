/**
 * Consolidated artifact extraction from AI-generated text.
 *
 * Extracts typed blocks like `json:persona-config`, `md:soul`, `md:agents`,
 * `md:identity`, `md:user`, `md:heartbeat`, `md:persona`, `md:knowledge-*`
 * from streaming or complete AI responses.
 *
 * Single source of truth — replaces distributed regex extraction.
 */

import type { ZodType } from "zod";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single extracted artifact from AI output */
export interface ExtractedArtifact {
  /** Block type prefix (e.g. "json", "md") */
  format: "json" | "md";
  /** Block label after the colon (e.g. "persona-config", "soul", "knowledge-industry") */
  label: string;
  /** Raw content between the fences */
  content: string;
}

/** All artifacts grouped by their intended use */
export interface ExtractedArtifacts {
  /** All extracted blocks keyed by full label (e.g. "json:persona-config") */
  blocks: Map<string, ExtractedArtifact>;
  /** Parsed JSON blocks (label → parsed object) */
  json: Map<string, unknown>;
  /** Markdown blocks (label → raw markdown string) */
  markdown: Map<string, string>;
}

// ---------------------------------------------------------------------------
// Extraction
// ---------------------------------------------------------------------------

/**
 * Pattern to match fenced code blocks with typed labels.
 *
 * Matches patterns like:
 * ```json:persona-config
 * { ... }
 * ```
 *
 * ```md:soul
 * # Soul content
 * ```
 *
 * Group 1: format (json|md)
 * Group 2: label (persona-config, soul, etc.)
 * Group 3: content (everything between the fences)
 */
const ARTIFACT_BLOCK_PATTERN = /```(json|md):([a-z][a-z0-9-]*)\s*\n([\s\S]*?)```/g;

/**
 * Extract all typed artifact blocks from AI-generated text.
 * Uses `matchAll` to avoid shared global regex state.
 *
 * @param text - Complete or partial AI response text
 * @returns Grouped artifacts with parsed JSON and raw markdown
 */
export function extractArtifacts(text: string): ExtractedArtifacts {
  const blocks = new Map<string, ExtractedArtifact>();
  const json = new Map<string, unknown>();
  const markdown = new Map<string, string>();

  for (const match of text.matchAll(ARTIFACT_BLOCK_PATTERN)) {
    const format = match[1] as "json" | "md";
    const label = match[2];
    const content = match[3].trim();
    const fullLabel = `${format}:${label}`;

    const artifact: ExtractedArtifact = { format, label, content };
    blocks.set(fullLabel, artifact);

    if (format === "json") {
      try {
        json.set(label, JSON.parse(content));
      } catch {
        // Store raw string if JSON is malformed — caller can handle
        json.set(label, content);
      }
    } else {
      markdown.set(label, content);
    }
  }

  return { blocks, json, markdown };
}

// ---------------------------------------------------------------------------
// Convenience Helpers
// ---------------------------------------------------------------------------

/**
 * Extract a single JSON block by label, parsed and optionally validated.
 *
 * When a Zod `schema` is provided the parsed value is run through
 * `schema.safeParse`. If validation fails, `undefined` is returned so
 * callers never receive a structurally-invalid object typed as `T`.
 *
 * Without a schema the function falls back to an unchecked `as T` cast
 * (backward-compatible, but callers should prefer the schema overload).
 *
 * @example
 * // With validation (preferred)
 * const cfg = extractJsonBlock(text, "project-config", ProjectConfigSchema);
 *
 * // Without validation (legacy — avoids breaking existing callers)
 * const raw = extractJsonBlock(text, "project-config");
 */
export function extractJsonBlock<T = unknown>(
  text: string,
  label: string,
  schema?: ZodType<T>,
): T | undefined {
  const artifacts = extractArtifacts(text);
  const value = artifacts.json.get(label);
  if (value === undefined || typeof value === "string") return undefined;

  if (schema) {
    const result = schema.safeParse(value);
    return result.success ? result.data : undefined;
  }

  return value as T;
}

/**
 * Extract a single markdown block by label.
 * Returns undefined if not found.
 */
export function extractMarkdownBlock(
  text: string,
  label: string,
): string | undefined {
  const artifacts = extractArtifacts(text);
  return artifacts.markdown.get(label);
}

/**
 * Extract all brain files (md:soul, md:agents, md:identity, md:user,
 * md:heartbeat, md:persona, md:memory) from AI output.
 *
 * Returns a record keyed by filename (e.g. "SOUL.md", "AGENTS.md").
 */
export function extractBrainFiles(
  text: string,
): Record<string, string> {
  const artifacts = extractArtifacts(text);
  const LABEL_TO_FILE: Record<string, string> = {
    soul: "SOUL.md",
    agents: "AGENTS.md",
    identity: "IDENTITY.md",
    user: "USER.md",
    heartbeat: "HEARTBEAT.md",
    persona: "PERSONA.md",
    memory: "MEMORY.md",
  };

  const result: Record<string, string> = {};
  for (const [label, filename] of Object.entries(LABEL_TO_FILE)) {
    const content = artifacts.markdown.get(label);
    if (content) {
      result[filename] = content;
    }
  }
  return result;
}

/**
 * Extract all knowledge files (md:knowledge-*) from AI output.
 *
 * Returns a record keyed by filename (e.g. "industry.md", "tools.md").
 * The "knowledge-" prefix is stripped from the label to form the filename.
 */
export function extractKnowledgeFiles(
  text: string,
): Record<string, string> {
  const artifacts = extractArtifacts(text);
  const result: Record<string, string> = {};

  for (const [label, content] of artifacts.markdown) {
    if (label.startsWith("knowledge-")) {
      const filename = label.slice("knowledge-".length) + ".md";
      result[filename] = content;
    }
  }
  return result;
}
