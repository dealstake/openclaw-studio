/**
 * Fork Registry — localStorage-based persistence of fork relationships.
 *
 * Stores fork metadata so we can reconstruct parent→child trees
 * across sessions and page reloads. Each entry represents a
 * forked session and its relationship to the source.
 *
 * Storage key: `studio:fork-registry`
 * Format: Record<childSessionKey, ForkRegistryEntry>
 */

import type { ForkMetadata } from "./forkService";

// ── Types ───────────────────────────────────────────────────────────

export interface ForkRegistryEntry {
  /** The forked (child) session key */
  childSessionKey: string;
  /** Source (parent) session key */
  sourceSessionKey: string;
  /** Step index in the source where the fork happened */
  forkAtIndex: number;
  /** Timestamp when the fork was created */
  createdAt: number;
  /** Optional label */
  label?: string;
  /** Model override in the forked session */
  model?: string;
}

export interface ForkTreeNode {
  /** Session key */
  sessionKey: string;
  /** Display name (if available) */
  displayName?: string;
  /** Fork point info (null for root) */
  forkInfo: {
    forkAtIndex: number;
    createdAt: number;
    label?: string;
    model?: string;
  } | null;
  /** Child forks */
  children: ForkTreeNode[];
}

// ── Storage ─────────────────────────────────────────────────────────

const STORAGE_KEY = "studio:fork-registry";
const MAX_ENTRIES = 200; // Prevent unbounded growth

function loadRegistry(): Record<string, ForkRegistryEntry> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, ForkRegistryEntry>;
  } catch {
    return {};
  }
}

function saveRegistry(registry: Record<string, ForkRegistryEntry>): void {
  try {
    // Prune if over limit — remove oldest entries
    const entries = Object.entries(registry);
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => a[1].createdAt - b[1].createdAt);
      const pruned = Object.fromEntries(entries.slice(-MAX_ENTRIES));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pruned));
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
    }
  } catch {
    // Ignore storage errors
  }
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Register a fork relationship. Called after a successful fork.
 */
export function registerFork(
  childSessionKey: string,
  metadata: ForkMetadata,
): void {
  const registry = loadRegistry();
  registry[childSessionKey] = {
    childSessionKey,
    sourceSessionKey: metadata.sourceSessionKey,
    forkAtIndex: metadata.forkAtIndex,
    createdAt: metadata.createdAt,
    label: metadata.label,
    model: metadata.model,
  };
  saveRegistry(registry);
}

/**
 * Get the fork entry for a specific child session.
 */
export function getForkEntry(childSessionKey: string): ForkRegistryEntry | null {
  const registry = loadRegistry();
  return registry[childSessionKey] ?? null;
}

/**
 * Get all fork entries where the given session is the source (parent).
 */
export function getChildForks(sourceSessionKey: string): ForkRegistryEntry[] {
  const registry = loadRegistry();
  return Object.values(registry).filter(
    (entry) => entry.sourceSessionKey === sourceSessionKey,
  );
}

/**
 * Check if a session has any forks (is a parent).
 */
export function hasForks(sessionKey: string): boolean {
  const registry = loadRegistry();
  return Object.values(registry).some(
    (entry) => entry.sourceSessionKey === sessionKey,
  );
}

/**
 * Check if a session is a fork (has a parent).
 */
export function isFork(sessionKey: string): boolean {
  const registry = loadRegistry();
  return sessionKey in registry;
}

/**
 * Build a fork tree rooted at the given session key.
 * Walks up to find the root, then builds the full tree down.
 */
export function buildForkTree(
  sessionKey: string,
  displayNameMap?: Map<string, string>,
): ForkTreeNode {
  const registry = loadRegistry();

  // Walk up to find root
  let rootKey = sessionKey;
  const visited = new Set<string>();
  while (true) {
    if (visited.has(rootKey)) break; // Cycle protection
    visited.add(rootKey);
    const entry = registry[rootKey];
    if (!entry) break;
    rootKey = entry.sourceSessionKey;
  }

  // Build tree recursively from root
  function buildNode(key: string): ForkTreeNode {
    const entry = registry[key];
    const children = Object.values(registry)
      .filter((e) => e.sourceSessionKey === key)
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((e) => buildNode(e.childSessionKey));

    return {
      sessionKey: key,
      displayName: displayNameMap?.get(key),
      forkInfo: entry
        ? {
            forkAtIndex: entry.forkAtIndex,
            createdAt: entry.createdAt,
            label: entry.label,
            model: entry.model,
          }
        : null,
      children,
    };
  }

  return buildNode(rootKey);
}

/**
 * Remove a fork entry (e.g., when a session is deleted).
 */
export function removeForkEntry(childSessionKey: string): void {
  const registry = loadRegistry();
  if (childSessionKey in registry) {
    delete registry[childSessionKey];
    saveRegistry(registry);
  }
}

/**
 * Get all entries in the registry (for debugging/export).
 */
export function getAllForkEntries(): ForkRegistryEntry[] {
  return Object.values(loadRegistry());
}
