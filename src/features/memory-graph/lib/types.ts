/**
 * Memory Knowledge Graph — Type Definitions
 *
 * Represents the entity graph extracted from an agent's memory files
 * (MEMORY.md, memory/*.md, projects/*.md).
 *
 * Phase 1: Data model + extraction types only (no UI).
 */

// ---------------------------------------------------------------------------
// Entity types
// ---------------------------------------------------------------------------

export type EntityType =
  | "person"    // Named individuals: @mentions, proper names
  | "project"   // Project references: slugs, named initiatives
  | "decision"  // Architectural/process decisions
  | "tool"      // CLI tools, APIs, libraries, services
  | "date"      // Temporal markers
  | "concept";  // Abstract topics (patterns, practices)

export type RelationType =
  | "co-occurrence"   // Entities mentioned in the same paragraph
  | "works-on"        // Person ↔ project
  | "decided"         // Person/agent decided something
  | "uses"            // Entity uses a tool/library
  | "mentioned-with"; // Generic co-mention fallback

// ---------------------------------------------------------------------------
// Core graph nodes & edges
// ---------------------------------------------------------------------------

/** A single entity extracted from agent memory files. */
export interface MemoryEntity {
  /** Stable slug-style ID, e.g. "person:mike", "project:openclaw-studio" */
  id: string;
  type: EntityType;
  /** Human-readable display label */
  label: string;
  /** Total occurrence count across all files */
  mentions: number;
  /** Relative paths of files where this entity appears */
  files: string[];
  /** ISO-8601 date string of the most recent file that mentions this entity */
  lastSeen?: string;
  /** Up to 3 representative text snippets (sentence-level context) */
  snippets: string[];
}

/** A directed or undirected relationship between two entities. */
export interface MemoryRelation {
  /** Compound ID: "{source}--{type}--{target}" */
  id: string;
  source: string;
  target: string;
  type: RelationType;
  /** Accumulated co-occurrence / confidence weight */
  weight: number;
}

// ---------------------------------------------------------------------------
// Graph container returned by the API
// ---------------------------------------------------------------------------

export interface MemoryGraphStats {
  totalFiles: number;
  totalEntities: number;
  totalRelations: number;
  lastUpdated: number; // epoch ms
}

export interface MemoryGraphData {
  nodes: MemoryEntity[];
  edges: MemoryRelation[];
  stats: MemoryGraphStats;
  health: MemoryHealthStats;
  conflicts: MemoryConflict[];
  /** Per-entity health keyed by entity ID */
  entityHealth: Record<string, EntityHealthStatus>;
}

// ---------------------------------------------------------------------------
// Memory Health types (Phase 3)
// ---------------------------------------------------------------------------

/** Health status for an individual entity. */
export interface EntityHealthStatus {
  /** Entity is stale if not referenced in any file modified within staleDays. */
  isStale: boolean;
  /** Number of days since the entity was last seen. */
  daysSinceLastSeen: number | null;
}

/** A detected conflict between memory entries. */
export interface MemoryConflict {
  /** Unique ID for the conflict */
  id: string;
  /** Entity IDs involved in the conflict */
  entityIds: string[];
  /** Human-readable description of the conflict */
  description: string;
  /** Files containing the conflicting statements */
  files: string[];
  /** Severity: "low" = minor inconsistency, "high" = direct contradiction */
  severity: "low" | "high";
}

/** Aggregate health stats for the entire memory graph. */
export interface MemoryHealthStats {
  /** Number of entities not referenced in >staleDays */
  staleCount: number;
  /** Number of detected conflicts */
  conflictCount: number;
  /** Average days since last seen across all entities (with dates) */
  avgFreshnessDays: number;
  /** Freshest entity date (ISO string) */
  newestEntityDate: string | null;
  /** Stalest entity date (ISO string) */
  oldestEntityDate: string | null;
}

// ---------------------------------------------------------------------------
// Extraction helpers
// ---------------------------------------------------------------------------

/** A memory file fed into the extractor. */
export interface MemoryFile {
  /** Relative path within the agent workspace, e.g. "MEMORY.md" */
  path: string;
  /** Full text content of the file */
  content: string;
  /** Last-modified timestamp (epoch ms) */
  updatedAt: number;
}
