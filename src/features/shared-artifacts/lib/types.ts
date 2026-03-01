/**
 * Shared Artifacts — Type Definitions
 *
 * A SharedArtifact is a named piece of content (text, JSON, markdown, etc.)
 * produced by one agent/session and made available for consumption by others.
 *
 * Phase 1: Data layer — types only (no React).
 */

// ─── Core Domain Types ────────────────────────────────────────────────────────

export type SharedArtifactMimeType =
  | "text/plain"
  | "text/markdown"
  | "application/json"
  | "text/html"
  | "text/csv"
  | "application/octet-stream";

/**
 * A single shared artifact record.
 * Stored locally in the Studio DB; accessible via /api/shared-artifacts.
 */
export interface SharedArtifact {
  /** UUID primary key */
  id: string;
  /** Agent that produced this artifact (e.g. "alex", "reporter") */
  sourceAgentId: string;
  /** Session key that produced this artifact (e.g. "agent:alex:main") */
  sourceSessionKey: string;
  /** Human-readable name for the artifact */
  name: string;
  /** MIME type — used to choose preview renderer */
  mimeType: SharedArtifactMimeType;
  /** Full text content of the artifact (stored inline for ≤1MB) */
  content: string;
  /**
   * Arbitrary structured metadata — e.g. task slug, prompt,
   * git commit hash, processing stats. Always a valid JSON object string.
   */
  metadataJson: string;
  /** ISO-8601 creation timestamp */
  createdAt: string;
}

// ─── API Request / Response Types ─────────────────────────────────────────────

/** Body for POST /api/shared-artifacts */
export interface CreateSharedArtifactRequest {
  sourceAgentId: string;
  sourceSessionKey: string;
  name: string;
  mimeType: SharedArtifactMimeType;
  content: string;
  metadata?: Record<string, unknown>;
}

/** Response for GET /api/shared-artifacts */
export interface SharedArtifactsListResponse {
  artifacts: SharedArtifact[];
  total: number;
}

/** Response for GET /api/shared-artifacts/:id */
export interface SharedArtifactGetResponse {
  artifact: SharedArtifact;
}

// ─── Type Guards ──────────────────────────────────────────────────────────────

const VALID_MIME_TYPES = new Set<string>([
  "text/plain",
  "text/markdown",
  "application/json",
  "text/html",
  "text/csv",
  "application/octet-stream",
]);

export function isValidMimeType(value: unknown): value is SharedArtifactMimeType {
  return typeof value === "string" && VALID_MIME_TYPES.has(value);
}

export function isSharedArtifact(value: unknown): value is SharedArtifact {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.sourceAgentId === "string" &&
    typeof v.sourceSessionKey === "string" &&
    typeof v.name === "string" &&
    isValidMimeType(v.mimeType) &&
    typeof v.content === "string" &&
    typeof v.metadataJson === "string" &&
    typeof v.createdAt === "string"
  );
}

export function isSharedArtifactsListResponse(
  value: unknown,
): value is SharedArtifactsListResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return Array.isArray(v.artifacts) && typeof v.total === "number";
}

export function isSharedArtifactGetResponse(
  value: unknown,
): value is SharedArtifactGetResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return isSharedArtifact(v.artifact);
}
