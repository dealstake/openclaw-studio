import { NextResponse } from "next/server";

import { isSafeAgentId } from "@/lib/workspace/resolve";

/**
 * Result of validating an agentId from request params/body.
 * On success, `agentId` is the trimmed value.
 * On failure, `error` is a NextResponse ready to return.
 */
export type AgentIdValidation =
  | { ok: true; agentId: string }
  | { ok: false; error: NextResponse };

/**
 * Validate and trim an agentId string from request input.
 * Returns a typed result — check `ok` before using.
 */
export function validateAgentId(
  raw: string | null | undefined
): AgentIdValidation {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  if (!trimmed) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: "agentId is required." },
        { status: 400 }
      ),
    };
  }
  if (!isSafeAgentId(trimmed)) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: `Invalid agentId: ${trimmed}` },
        { status: 400 }
      ),
    };
  }
  return { ok: true, agentId: trimmed };
}

/** Error thrown when the sidecar proxy is unavailable. */
interface SidecarUnavailableError extends Error {
  name: "SidecarUnavailableError";
}

function isSidecarUnavailableError(
  err: unknown
): err is SidecarUnavailableError {
  return err instanceof Error && err.name === "SidecarUnavailableError";
}

/**
 * Shared API error handler. Handles common error patterns:
 * - SidecarUnavailableError → 503
 * - Path traversal / escape → 403
 * - Not found → 404
 * - Everything else → 500
 *
 * @param err    The caught error
 * @param tag    Log tag, e.g. "workspace/file GET"
 * @param fallback  Fallback message if err is not an Error
 */
export function handleApiError(
  err: unknown,
  tag: string,
  fallback = "Internal server error."
): NextResponse {
  // Sidecar unavailable → 503
  if (isSidecarUnavailableError(err)) {
    return NextResponse.json(
      { error: err.message, code: "SIDECAR_UNAVAILABLE" },
      { status: 503 }
    );
  }

  const message = err instanceof Error ? err.message : fallback;
  console.error(`[${tag}]`, message);

  // Not found
  if (message.includes("not found")) {
    return NextResponse.json({ error: message }, { status: 404 });
  }

  // Path traversal / escape
  if (message.includes("traversal") || message.includes("escape")) {
    return NextResponse.json({ error: message }, { status: 403 });
  }

  return NextResponse.json({ error: message }, { status: 500 });
}
