import { NextResponse } from "next/server";

import {
  BEADS_WORKSPACE_NOT_INITIALIZED_ERROR_MESSAGE,
  isBeadsWorkspaceError,
} from "@/lib/task-control-plane/br-runner";

/**
 * Shared error handler for task-control-plane routes.
 * Returns a 400 for beads workspace errors, 502 for everything else.
 */
export function handleBeadsError(
  err: unknown,
  fallback = "Failed to load task control plane data.",
): NextResponse {
  const message = err instanceof Error ? err.message : fallback;
  console.error(message);
  if (isBeadsWorkspaceError(message)) {
    return NextResponse.json(
      { error: BEADS_WORKSPACE_NOT_INITIALIZED_ERROR_MESSAGE },
      { status: 400 },
    );
  }
  return NextResponse.json({ error: message }, { status: 502 });
}
