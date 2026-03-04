/**
 * Memory Knowledge Graph — Entity Extractor
 *
 * NLP-lite extraction of entities and relationships from agent memory files.
 * Uses regex patterns — no ML, no external services.
 *
 * Supported entity types: person, project, decision, tool, date, concept
 * Supported relation types: co-occurrence, works-on, decided, uses
 */

import type {
  EntityHealthStatus,
  EntityType,
  MemoryConflict,
  MemoryEntity,
  MemoryFile,
  MemoryGraphData,
  MemoryHealthStats,
  MemoryRelation,
  RelationType,
} from "./types";

// ---------------------------------------------------------------------------
// Pattern definitions
// ---------------------------------------------------------------------------

/**
 * Known first-name list for standalone name recognition.
 * Intentionally small — avoid false positives on common English words.
 */
const KNOWN_NAMES = new Set([
  "Mike", "Michael", "Alex", "Alice", "Bob", "Charlie", "Dave", "David",
  "Eve", "Frank", "Grace", "Hank", "Ivan", "Jane", "Jake", "James",
  "John", "Kate", "Kevin", "Laura", "Leo", "Lisa", "Mark", "Matt",
  "Matt", "Nick", "Olivia", "Paul", "Peter", "Rachel", "Ryan", "Sam",
  "Sarah", "Scott", "Steve", "Tom", "Victor", "Will", "Zoe",
]);

/** Matches capitalized words that appear in the known names set. */
const STANDALONE_NAME_RE = /\b([A-Z][a-z]{2,})\b/g;



/**
 * Well-known tool names to use as a positive-confirmation list.
 * Prevents treating every hyphenated string as a tool.
 */
const KNOWN_TOOLS = new Set([
  // Languages & runtimes
  "typescript", "javascript", "python", "node", "nodejs", "deno",
  // Frameworks
  "nextjs", "next.js", "react", "vue", "svelte", "remix", "astro",
  // State
  "zustand", "redux", "jotai", "recoil",
  // Styling
  "tailwind", "tailwindcss", "shadcn", "radix",
  // Backend
  "fastapi", "express", "hono", "prisma", "drizzle",
  // Infrastructure
  "docker", "kubernetes", "terraform", "gcp", "aws", "vercel", "cloudflare",
  // AI/ML
  "openai", "anthropic", "gemini", "langchain", "langgraph", "langfuse",
  // Databases
  "postgres", "postgresql", "mysql", "sqlite", "redis", "mongodb", "supabase",
  // Tools
  "git", "github", "gitlab", "vscode", "cursor", "neovim",
  "vitest", "jest", "playwright", "cypress",
  // OpenClaw ecosystem
  "openclaw", "gateway", "sidecar", "clawdbot",
  // Common CLIs  
  "gemini", "oracle", "memo", "things", "remindctl", "wacli", "imsg",
]);

/**
 * ISO date pattern — YYYY-MM-DD
 */
const DATE_RE = /\b(\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\b/g;

/**
 * Relative date expressions (currently unused — reserved for future expansion)
 * /\b((?:last|this|next)\s+(?:week|month|year|quarter)|yesterday|today|tomorrow|Q[1-4]\s+\d{4}|\d{4})\b/gi
 */

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

const slugify = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const makeId = (type: EntityType, label: string): string =>
  `${type}:${slugify(label)}`;

const makeRelationId = (source: string, type: RelationType, target: string): string =>
  `${source}--${type}--${target}`;

/**
 * Truncate a snippet to ~120 characters, cutting at a word boundary.
 */
const truncateSnippet = (s: string, maxLen = 120): string => {
  const trimmed = s.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLen) return trimmed;
  const cut = trimmed.lastIndexOf(" ", maxLen);
  return `${trimmed.slice(0, cut > 0 ? cut : maxLen)}…`;
};

// ---------------------------------------------------------------------------
// Internal accumulation types
// ---------------------------------------------------------------------------

interface EntityAccumulator {
  type: EntityType;
  label: string;
  mentions: number;
  files: Set<string>;
  latestMs: number;
  snippets: string[];
}

type EntityMap = Map<string, EntityAccumulator>;

interface RelationAccumulator {
  source: string;
  target: string;
  type: RelationType;
  weight: number;
}

type RelationMap = Map<string, RelationAccumulator>;

// ---------------------------------------------------------------------------
// Accumulator helpers
// ---------------------------------------------------------------------------

function upsertEntity(
  map: EntityMap,
  type: EntityType,
  label: string,
  file: string,
  updatedAt: number,
  snippet: string,
): string {
  const id = makeId(type, label);
  const existing = map.get(id);
  if (existing) {
    existing.mentions += 1;
    existing.files.add(file);
    if (updatedAt > existing.latestMs) existing.latestMs = updatedAt;
    if (existing.snippets.length < 3 && snippet) {
      existing.snippets.push(truncateSnippet(snippet));
    }
  } else {
    map.set(id, {
      type,
      label,
      mentions: 1,
      files: new Set([file]),
      latestMs: updatedAt,
      snippets: snippet ? [truncateSnippet(snippet)] : [],
    });
  }
  return id;
}

function upsertRelation(
  map: RelationMap,
  source: string,
  target: string,
  type: RelationType,
): void {
  // Keep canonical order for undirected co-occurrence
  const [s, t] = type === "co-occurrence" && source > target ? [target, source] : [source, target];
  const id = makeRelationId(s, type, t);
  const existing = map.get(id);
  if (existing) {
    existing.weight += 1;
  } else {
    map.set(id, { source: s, target: t, type, weight: 1 });
  }
}

// ---------------------------------------------------------------------------
// Paragraph splitting
// ---------------------------------------------------------------------------

/**
 * Split file content into paragraphs (blocks separated by blank lines).
 * Strips markdown headings / list markers for cleaner snippet text.
 */
function splitParagraphs(content: string): string[] {
  return content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 10);
}

// ---------------------------------------------------------------------------
// Per-file extraction
// ---------------------------------------------------------------------------

function extractFromFile(
  file: MemoryFile,
  entityMap: EntityMap,
  relationMap: RelationMap,
): void {
  const paragraphs = splitParagraphs(file.content);

  for (const para of paragraphs) {
    const foundInPara: string[] = [];

    // ── Persons ──────────────────────────────────────────────────────────────
    // @mentions
    for (const match of para.matchAll(/@([A-Za-z][A-Za-z0-9_-]{1,39})\b/g)) {
      const label = match[1];
      const id = upsertEntity(entityMap, "person", label, file.path, file.updatedAt, para);
      foundInPara.push(id);
    }

    // Standalone known names
    for (const match of para.matchAll(STANDALONE_NAME_RE)) {
      const name = match[1];
      if (KNOWN_NAMES.has(name)) {
        const id = upsertEntity(entityMap, "person", name, file.path, file.updatedAt, para);
        if (!foundInPara.includes(id)) foundInPara.push(id);
      }
    }

    // Context-clue names ("by Mike", "with Alice")
    const ctxRe = /\b(?:by|with|from|assigned to|reported by)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b/g;
    for (const match of para.matchAll(ctxRe)) {
      const label = match[1].trim();
      if (label.split(" ").every((w) => KNOWN_NAMES.has(w) || w.length > 3)) {
        const id = upsertEntity(entityMap, "person", label, file.path, file.updatedAt, para);
        if (!foundInPara.includes(id)) foundInPara.push(id);
      }
    }

    // ── Projects ─────────────────────────────────────────────────────────────
    // "Project: X"
    for (const match of para.matchAll(/(?:^|\b)(?:[Pp]roject):\s*([A-Za-z][A-Za-z0-9 _-]{2,40})/gm)) {
      const label = match[1].trim();
      const id = upsertEntity(entityMap, "project", label, file.path, file.updatedAt, para);
      if (!foundInPara.includes(id)) foundInPara.push(id);
    }

    // "projects/<name>.md" references
    for (const match of para.matchAll(/projects\/([a-z][a-z0-9-]+)\.md/g)) {
      const label = match[1];
      const id = upsertEntity(entityMap, "project", label, file.path, file.updatedAt, para);
      if (!foundInPara.includes(id)) foundInPara.push(id);
    }

    // Kebab-slug project names (≥3 segments, not a date)
    for (const match of para.matchAll(/\b([a-z][a-z0-9]+-[a-z0-9]+-[a-z0-9][a-z0-9-]*)\b/g)) {
      const label = match[1];
      // Skip date-like patterns (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(label)) continue;
      // Skip known tools (they'll be captured in tool extraction)
      if (KNOWN_TOOLS.has(label)) continue;
      const id = upsertEntity(entityMap, "project", label, file.path, file.updatedAt, para);
      if (!foundInPara.includes(id)) foundInPara.push(id);
    }

    // ── Decisions ────────────────────────────────────────────────────────────
    const decisionRe =
      /(?:decided|chose|choosing|selected|adopted|switched to|migrated to|will use)\s+([A-Za-z][A-Za-z0-9 _/.-]{2,60}?)(?:[.,;)\n]|$)/gi;
    for (const match of para.matchAll(decisionRe)) {
      const label = match[1].trim().replace(/\*\*/g, "");
      if (label.length < 3) continue;
      const id = upsertEntity(entityMap, "decision", label, file.path, file.updatedAt, para);
      if (!foundInPara.includes(id)) foundInPara.push(id);
    }

    // ── Tools ────────────────────────────────────────────────────────────────
    // Backtick-wrapped identifiers
    for (const match of para.matchAll(/`([a-zA-Z][a-zA-Z0-9_./:-]{1,50})`/g)) {
      const label = match[1].toLowerCase().replace(/^[@/]/, "");
      if (KNOWN_TOOLS.has(label) || KNOWN_TOOLS.has(label.split("/").pop() ?? label)) {
        const id = upsertEntity(entityMap, "tool", label, file.path, file.updatedAt, para);
        if (!foundInPara.includes(id)) foundInPara.push(id);
      }
    }

    // Known tool names mentioned without backticks
    for (const tool of KNOWN_TOOLS) {
      const toolRe = new RegExp(`\\b${escapeRegExp(tool)}\\b`, "i");
      if (toolRe.test(para)) {
        const id = upsertEntity(entityMap, "tool", tool, file.path, file.updatedAt, para);
        if (!foundInPara.includes(id)) foundInPara.push(id);
      }
    }

    // ── Dates ────────────────────────────────────────────────────────────────
    for (const match of para.matchAll(DATE_RE)) {
      const label = match[1];
      const id = upsertEntity(entityMap, "date", label, file.path, file.updatedAt, para);
      if (!foundInPara.includes(id)) foundInPara.push(id);
    }

    // ── Relations from co-occurrence ─────────────────────────────────────────
    // Any two distinct non-date entities found in the same paragraph are related
    const nonDateIds = foundInPara.filter((id) => !id.startsWith("date:"));
    if (nonDateIds.length >= 2) {
      for (let i = 0; i < nonDateIds.length; i++) {
        for (let j = i + 1; j < nonDateIds.length; j++) {
          upsertRelation(relationMap, nonDateIds[i], nonDateIds[j], "co-occurrence");
        }
      }
    }

    // ── Explicit semantic relations ──────────────────────────────────────────
    // "X working on Y" / "X assigned to Y"
    const worksOnRe = /\b([A-Z][a-z]{2,})\b.*?\b(?:working on|assigned to|implementing|building|owns?)\b.*?(?:project[s]?\s+)?([a-z][a-z0-9-]+(?:-[a-z0-9]+)+)/gi;
    for (const match of para.matchAll(worksOnRe)) {
      const person = makeId("person", match[1]);
      const proj = makeId("project", match[2]);
      if (entityMap.has(person) && entityMap.has(proj)) {
        upsertRelation(relationMap, person, proj, "works-on");
      }
    }

    // "X decided/chose/adopted Y"
    const decidedRe = /\b([A-Z][a-z]{2,})\b.*?\b(?:decided|chose|adopted|selected)\b.*?([A-Za-z][A-Za-z0-9 _/-]{2,40}?)(?:[.,;\n]|$)/g;
    for (const match of para.matchAll(decidedRe)) {
      const person = makeId("person", match[1]);
      const decision = makeId("decision", match[2].trim());
      if (entityMap.has(person) && entityMap.has(decision)) {
        upsertRelation(relationMap, person, decision, "decided");
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Escape helper for dynamic RegExp
// ---------------------------------------------------------------------------

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Health analysis (Phase 3)
// ---------------------------------------------------------------------------

const MS_PER_DAY = 86_400_000;

/** Default staleness threshold in days. */
const STALE_THRESHOLD_DAYS = 30;

/**
 * Compute per-entity health status based on staleness.
 */
function computeEntityHealth(
  nodes: MemoryEntity[],
  nowMs: number,
  staleDays: number = STALE_THRESHOLD_DAYS,
): Record<string, EntityHealthStatus> {
  const result: Record<string, EntityHealthStatus> = {};
  for (const node of nodes) {
    if (node.lastSeen) {
      const lastMs = new Date(node.lastSeen).getTime();
      const daysSince = Math.floor((nowMs - lastMs) / MS_PER_DAY);
      result[node.id] = {
        isStale: daysSince > staleDays,
        daysSinceLastSeen: daysSince,
      };
    } else {
      result[node.id] = { isStale: true, daysSinceLastSeen: null };
    }
  }
  return result;
}

/**
 * Detect conflicting memory entries.
 *
 * Current heuristics:
 * 1. Same entity (person/tool) referenced with different labels (alias conflict)
 * 2. Decision entities with contradictory verbs in different files
 */
function detectConflicts(
  nodes: MemoryEntity[],
  entityMap: EntityMap,
): MemoryConflict[] {
  const conflicts: MemoryConflict[] = [];
  let conflictIdx = 0;

  // 1. Decision contradictions: look for "switched from X to Y" vs entity for X
  const decisionNodes = nodes.filter((n) => n.type === "decision");
  const switchRe = /switched (?:from|away from)\s+([A-Za-z][A-Za-z0-9 _/.-]+?)\s+to\s+/i;
  for (const dn of decisionNodes) {
    for (const snippet of dn.snippets) {
      const match = switchRe.exec(snippet);
      if (match) {
        const oldTool = match[1].trim().toLowerCase();
        // See if the old tool is still referenced as actively "uses"
        const oldToolId = `tool:${oldTool.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
        const oldEntity = entityMap.get(oldToolId);
        if (oldEntity && oldEntity.mentions >= 3) {
          conflicts.push({
            id: `conflict-${conflictIdx++}`,
            entityIds: [dn.id, oldToolId],
            description: `Decision to switch away from "${match[1].trim()}" but it still has ${oldEntity.mentions} mentions`,
            files: [...new Set([...dn.files, ...oldEntity.files])].sort(),
            severity: "low",
          });
        }
      }
    }
  }

  // 2. Person aliases: different person entities with overlapping snippets
  const personNodes = nodes.filter((n) => n.type === "person");
  for (let i = 0; i < personNodes.length; i++) {
    for (let j = i + 1; j < personNodes.length; j++) {
      const a = personNodes[i];
      const b = personNodes[j];
      // Check if they share files and one label contains the other (e.g. "Mike" vs "Michael")
      const sharedFiles = a.files.filter((f) => b.files.includes(f));
      const al = a.label.toLowerCase();
      const bl = b.label.toLowerCase();
      // Alias candidate: one is prefix of the other, OR they share enough common chars
      const shorter = al.length <= bl.length ? al : bl;
      const longer = al.length <= bl.length ? bl : al;
      const isAliasCandidate = longer.startsWith(shorter) || longer.includes(shorter);
      if (sharedFiles.length >= 2 && isAliasCandidate) {
        conflicts.push({
          id: `conflict-${conflictIdx++}`,
          entityIds: [a.id, b.id],
          description: `"${a.label}" and "${b.label}" may be the same person (appear in ${sharedFiles.length} shared files)`,
          files: sharedFiles.sort(),
          severity: "low",
        });
      }
    }
  }

  return conflicts;
}

/**
 * Compute aggregate health statistics.
 */
function computeHealthStats(
  entityHealth: Record<string, EntityHealthStatus>,
  conflicts: MemoryConflict[],
): MemoryHealthStats {
  let staleCount = 0;
  let totalDays = 0;
  let countWithDays = 0;
  let newestDate: string | null = null;
  let oldestDate: string | null = null;
  let minDays = Infinity;
  let maxDays = -Infinity;

  for (const h of Object.values(entityHealth)) {
    if (h.isStale) staleCount++;
    if (h.daysSinceLastSeen !== null) {
      totalDays += h.daysSinceLastSeen;
      countWithDays++;
      if (h.daysSinceLastSeen < minDays) minDays = h.daysSinceLastSeen;
      if (h.daysSinceLastSeen > maxDays) maxDays = h.daysSinceLastSeen;
    }
  }

  // Reconstruct dates from days offset
  const now = Date.now();
  if (minDays < Infinity) {
    newestDate = new Date(now - minDays * MS_PER_DAY).toISOString().slice(0, 10);
  }
  if (maxDays > -Infinity) {
    oldestDate = new Date(now - maxDays * MS_PER_DAY).toISOString().slice(0, 10);
  }

  return {
    staleCount,
    conflictCount: conflicts.length,
    avgFreshnessDays: countWithDays > 0 ? Math.round(totalDays / countWithDays) : 0,
    newestEntityDate: newestDate,
    oldestEntityDate: oldestDate,
  };
}

/**
 * Extract a knowledge graph from a list of memory files.
 *
 * Returns nodes (entities) and edges (relations) suitable for rendering
 * in a graph visualization or returning from an API endpoint.
 *
 * @param files - Array of MemoryFile objects (path, content, updatedAt)
 * @returns MemoryGraphData
 */
export function extractMemoryGraph(files: MemoryFile[]): MemoryGraphData {
  const entityMap: EntityMap = new Map();
  const relationMap: RelationMap = new Map();

  for (const file of files) {
    extractFromFile(file, entityMap, relationMap);
  }

  // ── Prune weak tool/date nodes (only 1 mention, no relations) ──────────────
  const relatedIds = new Set<string>();
  for (const rel of relationMap.values()) {
    relatedIds.add(rel.source);
    relatedIds.add(rel.target);
  }

  const nodes: MemoryEntity[] = [];
  for (const [id, acc] of entityMap) {
    // Keep node if:
    // - ≥2 mentions, OR
    // - has a relation, OR
    // - is person/project/decision type (always interesting)
    const isHighValue = acc.type === "person" || acc.type === "project" || acc.type === "decision";
    if (acc.mentions < 2 && !relatedIds.has(id) && !isHighValue) continue;

    nodes.push({
      id,
      type: acc.type,
      label: acc.label,
      mentions: acc.mentions,
      files: Array.from(acc.files).sort(),
      lastSeen:
        acc.latestMs > 0 ? new Date(acc.latestMs).toISOString().slice(0, 10) : undefined,
      snippets: acc.snippets,
    });
  }

  // Sort by mentions desc, then label asc
  nodes.sort((a, b) => b.mentions - a.mentions || a.label.localeCompare(b.label));

  // ── Build edges (only between surviving nodes) ─────────────────────────────
  const survivingIds = new Set(nodes.map((n) => n.id));

  const edges: MemoryRelation[] = [];
  for (const [id, rel] of relationMap) {
    if (!survivingIds.has(rel.source) || !survivingIds.has(rel.target)) continue;
    edges.push({
      id,
      source: rel.source,
      target: rel.target,
      type: rel.type,
      weight: rel.weight,
    });
  }

  // Sort edges by weight desc
  edges.sort((a, b) => b.weight - a.weight);

  const lastUpdated = files.reduce((max, f) => Math.max(max, f.updatedAt), 0);

  // Phase 3: Health analysis
  const nowMs = Date.now();
  const entityHealth = computeEntityHealth(nodes, nowMs);
  const conflicts = detectConflicts(nodes, entityMap);
  const health = computeHealthStats(entityHealth, conflicts);

  return {
    nodes,
    edges,
    stats: {
      totalFiles: files.length,
      totalEntities: nodes.length,
      totalRelations: edges.length,
      lastUpdated,
    },
    health,
    conflicts,
    entityHealth,
  };
}
