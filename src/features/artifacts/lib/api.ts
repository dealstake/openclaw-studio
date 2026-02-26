import type { DriveFile } from "../types";

/** Shape returned by artifact API endpoints on error. */
interface ApiErrorBody {
  error?: string;
}

/**
 * Extract a human-readable error message from a failed fetch Response.
 * Attempts to parse JSON `{ error }` from the body; falls back to HTTP status.
 */
export async function parseApiError(
  res: Response,
  fallbackPrefix = "Request failed",
): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (isApiErrorBody(body) && body.error) return body.error;
  } catch {
    // Body not JSON — fall through
  }
  return `${fallbackPrefix} (${res.status})`;
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  return typeof value === "object" && value !== null && "error" in value;
}

/** Expected shape of the /api/artifacts list response. */
interface ArtifactsListResponse {
  files: DriveFile[];
}

/**
 * Type guard for the artifacts list API response.
 * Validates top-level shape only (files array exists).
 */
export function isArtifactsListResponse(
  value: unknown,
): value is ArtifactsListResponse {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.files);
}
