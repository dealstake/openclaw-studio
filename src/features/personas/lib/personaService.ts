/**
 * Persona Service — CRUD, skill wiring, metrics aggregation.
 *
 * Server-side only. Uses filesystem + DB for persona management.
 */

import { promises as fsPromises } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import type {
  PersonaConfig,
  PersonaStatus,
  PersonaBrainFiles,
  KnowledgeFiles,
  PersonaRow,
} from "./personaTypes";
import { computePracticeMetrics } from "./practiceScoring";
import { generateDefaultBrainFiles } from "@/features/agents/lib/brainFileGenerator";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENTS_ROOT = path.join(os.homedir(), ".openclaw", "agents");

/** Allowed status transitions */
const VALID_TRANSITIONS: Record<PersonaStatus, PersonaStatus[]> = {
  draft: ["configuring", "active", "archived"],
  configuring: ["active", "draft", "archived"],
  active: ["paused", "archived"],
  paused: ["active", "archived"],
  archived: ["draft"],
};

// ---------------------------------------------------------------------------
// Path Helpers
// ---------------------------------------------------------------------------

function agentDir(personaId: string): string {
  return path.join(AGENTS_ROOT, personaId);
}

/** Validate personaId for filesystem safety — no dots, slashes, or traversal */
function validatePersonaId(personaId: string): void {
  if (!personaId || typeof personaId !== "string") {
    throw new Error("personaId is required");
  }
  // Strict: alphanumeric, hyphens, underscores only. No dots or slashes.
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(personaId)) {
    throw new Error(`Invalid personaId: "${personaId}" — must be alphanumeric with hyphens/underscores, max 128 chars`);
  }
}

/** Validate a knowledge filename — no path separators or traversal */
function validateFilename(filename: string): void {
  if (!filename || typeof filename !== "string") {
    throw new Error("filename is required");
  }
  if (/[./\\]/.test(filename.replace(/\.md$/, ""))) {
    throw new Error(`Invalid filename: "${filename}" — no path separators or dots allowed (except .md extension)`);
  }
  if (!filename.endsWith(".md")) {
    throw new Error(`Invalid filename: "${filename}" — must end with .md`);
  }
}

/** Async file existence check — avoids sync `existsSync` blocking the event loop */
async function fileExists(p: string): Promise<boolean> {
  try {
    await fsPromises.access(p);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Create Persona
// ---------------------------------------------------------------------------

export interface CreatePersonaOptions {
  config: PersonaConfig;
  /** AI-generated brain files (override defaults) */
  brainFiles?: Partial<PersonaBrainFiles>;
  /** Knowledge files for knowledge/ directory */
  knowledgeFiles?: KnowledgeFiles;
}

/**
 * Create a new persona agent on the filesystem.
 *
 * 1. Validates IDs and filenames
 * 2. Creates agent directory structure
 * 3. Writes brain files (AI-generated or defaults)
 * 4. Writes knowledge files
 *
 * Does NOT insert DB row — that's handled by the API route
 * which has access to the DB connection.
 */
export async function createPersonaAgent(options: CreatePersonaOptions): Promise<{
  agentDir: string;
  filesCreated: string[];
}> {
  const { config, brainFiles, knowledgeFiles } = options;

  validatePersonaId(config.personaId);

  const dir = agentDir(config.personaId);

  // Create directory structure
  await fsPromises.mkdir(dir, { recursive: true });
  await fsPromises.mkdir(path.join(dir, "memory"), { recursive: true });
  await fsPromises.mkdir(path.join(dir, "knowledge"), { recursive: true });
  await fsPromises.mkdir(path.join(dir, "training"), { recursive: true });

  // Generate default brain files, then overlay AI-generated ones
  const defaults = generateDefaultBrainFiles(config);
  const finalBrainFiles: Record<string, string> = { ...defaults };

  if (brainFiles) {
    for (const [filename, content] of Object.entries(brainFiles)) {
      if (content) {
        finalBrainFiles[filename] = content;
      }
    }
  }

  const filesCreated: string[] = [];

  // Write brain files (don't overwrite existing)
  for (const [filename, content] of Object.entries(finalBrainFiles)) {
    const filePath = path.join(dir, filename);
    if (!(await fileExists(filePath))) {
      await fsPromises.writeFile(filePath, content, "utf-8");
      filesCreated.push(filename);
    }
  }

  // Write knowledge files
  if (knowledgeFiles) {
    for (const [filename, content] of Object.entries(knowledgeFiles)) {
      validateFilename(filename);
      const filePath = path.join(dir, "knowledge", filename);
      if (!(await fileExists(filePath))) {
        await fsPromises.writeFile(filePath, content, "utf-8");
        filesCreated.push(`knowledge/${filename}`);
      }
    }
  }

  return { agentDir: dir, filesCreated };
}

// ---------------------------------------------------------------------------
// List Personas
// ---------------------------------------------------------------------------

/**
 * List persona agents from the filesystem.
 * Scans agent directories for PERSONA.md as the marker file.
 * Returns basic info; full config comes from DB.
 */
export async function listPersonaAgents(): Promise<Array<{
  personaId: string;
  hasPersonaMd: boolean;
  hasSoulMd: boolean;
}>> {
  if (!(await fileExists(AGENTS_ROOT))) return [];

  const entries = await fsPromises.readdir(AGENTS_ROOT, { withFileTypes: true });
  const results: Array<{
    personaId: string;
    hasPersonaMd: boolean;
    hasSoulMd: boolean;
  }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const personaMdPath = path.join(AGENTS_ROOT, entry.name, "PERSONA.md");
    const soulMdPath = path.join(AGENTS_ROOT, entry.name, "SOUL.md");

    if (await fileExists(personaMdPath)) {
      results.push({
        personaId: entry.name,
        hasPersonaMd: true,
        hasSoulMd: await fileExists(soulMdPath),
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Status Management
// ---------------------------------------------------------------------------

/**
 * Validate a status transition.
 * Throws if the transition is not allowed.
 */
export function validateStatusTransition(
  current: PersonaStatus,
  target: PersonaStatus,
): void {
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed || !allowed.includes(target)) {
    throw new Error(
      `Invalid status transition: ${current} → ${target}. Allowed: ${allowed?.join(", ") ?? "none"}`,
    );
  }
}

// ---------------------------------------------------------------------------
// DB Row Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a PersonaConfig to a PersonaRow for DB insertion.
 */
export function configToRow(config: PersonaConfig): PersonaRow {
  return {
    persona_id: config.personaId,
    display_name: config.displayName,
    template_key: config.templateKey,
    category: config.category,
    status: config.status,
    optimization_goals: JSON.stringify(config.optimizationGoals),
    metrics_json: JSON.stringify(computePracticeMetrics([], [])),
    created_at: config.createdAt,
    last_trained_at: config.lastTrainedAt,
    practice_count: config.practiceCount,
  };
}

/**
 * Convert a PersonaRow back to a partial PersonaConfig (DB fields only).
 */
export function rowToPartialConfig(row: PersonaRow): Pick<
  PersonaConfig,
  "personaId" | "displayName" | "templateKey" | "category" | "status" |
  "optimizationGoals" | "createdAt" | "lastTrainedAt" | "practiceCount"
> {
  let goals: string[] = [];
  try {
    goals = JSON.parse(row.optimization_goals);
  } catch (e) {
    console.error(`[personaService] Failed to parse optimization_goals for persona "${row.persona_id}":`, e);
  }

  return {
    personaId: row.persona_id,
    displayName: row.display_name,
    templateKey: row.template_key,
    category: row.category,
    status: row.status,
    optimizationGoals: goals,
    createdAt: row.created_at,
    lastTrainedAt: row.last_trained_at,
    practiceCount: row.practice_count,
  };
}
