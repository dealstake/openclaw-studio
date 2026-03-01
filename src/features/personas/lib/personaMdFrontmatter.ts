/**
 * PERSONA.md frontmatter utilities — Phase 6 of the Preflight Engine.
 *
 * Reads and writes a YAML frontmatter block (`--- ... ---`) at the top of
 * a persona's PERSONA.md file. Used to store the last preflight health-check
 * result so it persists across sessions and is visible in the agent's own
 * context window.
 *
 * Format:
 * ```yaml
 * ---
 * preflight_status: ready
 * preflight_checked_at: 2026-03-01T12:00:00.000Z
 * preflight_capabilities:
 *   - capability: voice
 *     display_name: Voice / Text-to-Speech
 *     status: ready
 *     required: true
 * ---
 * ```
 *
 * Design:
 * - No external YAML library — simple regex-based read, template-based write.
 * - Idempotent: inserts frontmatter block if absent, replaces if present.
 * - Server-side only (Node fs). Never call from client components.
 */

import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { PreflightResult, OverallPreflightStatus } from "./preflightTypes";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENTS_ROOT = path.join(os.homedir(), ".openclaw", "agents");

function personaMdPath(personaId: string): string {
  return path.join(AGENTS_ROOT, personaId, "PERSONA.md");
}

// ---------------------------------------------------------------------------
// Stored frontmatter shape
// ---------------------------------------------------------------------------

export interface PersonaPreflightFrontmatter {
  preflight_status: OverallPreflightStatus;
  preflight_checked_at: string;
  preflight_capabilities: Array<{
    capability: string;
    display_name: string;
    status: string;
    required: boolean;
  }>;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Read the YAML frontmatter block from PERSONA.md, if it exists.
 * Returns null when the file doesn't exist or has no frontmatter.
 */
export async function readPreflightFrontmatter(
  personaId: string,
): Promise<PersonaPreflightFrontmatter | null> {
  const mdPath = personaMdPath(personaId);
  let content: string;
  try {
    content = await fs.readFile(mdPath, "utf-8");
  } catch {
    return null;
  }

  // Match --- block at start of file
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!match) return null;

  const block = match[1];
  return parseFrontmatterBlock(block);
}

/**
 * Simple YAML-subset parser for our narrow frontmatter schema.
 * Handles scalars and one level of array-of-objects.
 */
function parseFrontmatterBlock(block: string): PersonaPreflightFrontmatter | null {
  try {
    const lines = block.split("\n");
    const result: Partial<PersonaPreflightFrontmatter> = {};
    let inCapabilities = false;
    let currentItem: Partial<
      PersonaPreflightFrontmatter["preflight_capabilities"][number]
    > | null = null;
    const capabilities: PersonaPreflightFrontmatter["preflight_capabilities"] = [];

    for (const rawLine of lines) {
      const line = rawLine.trimEnd();

      // Top-level key: value
      const topMatch = line.match(/^([a-z_]+):\s*(.*)$/);
      if (topMatch && !line.startsWith("  ")) {
        const [, key, value] = topMatch;
        inCapabilities = false;

        if (key === "preflight_status") {
          result.preflight_status = value as OverallPreflightStatus;
        } else if (key === "preflight_checked_at") {
          result.preflight_checked_at = value;
        } else if (key === "preflight_capabilities") {
          inCapabilities = true;
        }
        continue;
      }

      if (!inCapabilities) continue;

      // Array item start: "  - capability: voice"
      const itemStart = line.match(/^  - ([a-z_]+):\s*(.*)$/);
      if (itemStart) {
        if (currentItem) {
          capabilities.push(
            currentItem as PersonaPreflightFrontmatter["preflight_capabilities"][number],
          );
        }
        const [, key, value] = itemStart;
        currentItem = {};
        setCapField(currentItem, key, value);
        continue;
      }

      // Continuation of current item: "    status: ready"
      const itemCont = line.match(/^    ([a-z_]+):\s*(.*)$/);
      if (itemCont && currentItem) {
        const [, key, value] = itemCont;
        setCapField(currentItem, key, value);
      }
    }

    if (currentItem) {
      capabilities.push(
        currentItem as PersonaPreflightFrontmatter["preflight_capabilities"][number],
      );
    }
    result.preflight_capabilities = capabilities;

    if (!result.preflight_status || !result.preflight_checked_at) return null;
    return result as PersonaPreflightFrontmatter;
  } catch {
    return null;
  }
}

function setCapField(
  item: Partial<PersonaPreflightFrontmatter["preflight_capabilities"][number]>,
  key: string,
  value: string,
): void {
  if (key === "capability") item.capability = value;
  else if (key === "display_name") item.display_name = value;
  else if (key === "status") item.status = value;
  else if (key === "required") item.required = value === "true";
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Write (insert or replace) a preflight result as YAML frontmatter in
 * the persona's PERSONA.md file.
 *
 * Safe to call multiple times — always replaces the existing block.
 * If PERSONA.md doesn't exist, creates it with only the frontmatter.
 */
export async function writePreflightFrontmatter(
  personaId: string,
  result: PreflightResult,
): Promise<void> {
  const mdPath = personaMdPath(personaId);
  let existing: string;
  try {
    existing = await fs.readFile(mdPath, "utf-8");
  } catch {
    existing = "";
  }

  const frontmatter = buildFrontmatter(result);

  // Strip existing frontmatter block if present
  const stripped = existing.replace(/^---\n[\s\S]*?\n---\n/, "").trimStart();
  const updated = `${frontmatter}\n${stripped}`;

  await fs.writeFile(mdPath, updated, "utf-8");
}

/**
 * Serialize a PreflightResult into a YAML frontmatter block string.
 */
function buildFrontmatter(result: PreflightResult): string {
  const capLines = result.capabilities
    .map((cap) => {
      const displayName = cap.displayName.replace(/'/g, "''"); // escape single quotes
      return [
        `  - capability: ${cap.capability}`,
        `    display_name: '${displayName}'`,
        `    status: ${cap.status}`,
        `    required: ${cap.required}`,
      ].join("\n");
    })
    .join("\n");

  return [
    "---",
    `preflight_status: ${result.overall}`,
    `preflight_checked_at: ${result.checkedAt}`,
    `preflight_capabilities:`,
    capLines,
    "---",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Parse skill capabilities from existing PERSONA.md
// ---------------------------------------------------------------------------

/**
 * Parse the "## Skill Requirements" section from an existing PERSONA.md
 * and extract capability keys for use in health checks.
 *
 * Handles lines like:
 *   `  - Voice / Text-to-Speech (sag) [required]`
 *
 * Returns an array of capability keys that can be passed to runPreflight.
 * Returns an empty array when the section is missing or unparseable.
 *
 * NOTE: reads capability display names from PERSONA.md and reverse-maps
 * them via CAPABILITY_SKILL_MAP keys. Falls back to skill-key matching.
 */
export async function readPersonaCapabilityKeys(
  personaId: string,
  capabilitySkillMap: Record<string, { capability: string; skillKey: string }>,
): Promise<string[]> {
  const mdPath = personaMdPath(personaId);
  let content: string;
  try {
    content = await fs.readFile(mdPath, "utf-8");
  } catch {
    return [];
  }

  // Extract the Skill Requirements section
  const sectionMatch = content.match(
    /## Skill Requirements\n([\s\S]*?)(?:\n## |\n---|\n# |$)/,
  );
  if (!sectionMatch) return [];

  const section = sectionMatch[1];
  // Lines like: `  - Voice / Text-to-Speech (sag) [required]`
  const linePattern = /^\s*-\s+(.*?)\s+\(([^)]+)\)/gm;

  const foundCapabilities: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = linePattern.exec(section)) !== null) {
    const displayName = match[1].trim();
    const skillKey = match[2].trim();

    // Try to match by capability display name
    const byDisplay = Object.entries(capabilitySkillMap).find(
      ([, req]) =>
        req.capability.toLowerCase() === displayName.toLowerCase(),
    );
    if (byDisplay) {
      foundCapabilities.push(byDisplay[0]);
      continue;
    }

    // Fall back: match by skillKey
    const bySkill = Object.entries(capabilitySkillMap).find(
      ([, req]) => req.skillKey === skillKey,
    );
    if (bySkill) {
      foundCapabilities.push(bySkill[0]);
    }
  }

  return [...new Set(foundCapabilities)];
}
