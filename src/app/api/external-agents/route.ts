/**
 * GET /api/external-agents
 *
 * Detects running external AI coding agent processes (Claude Code, Cursor,
 * Codex, OpenCode) by scanning the OS process list via `ps aux`.
 *
 * Returns an `ExternalAgentsResponse` — always 200 even when no agents are
 * found (empty array). Only 500 on a hard OS error.
 */

import { exec as execCallback } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { detectExternalAgentsFromPs } from "@/features/external-agents/lib/processDetector";
import type { ExternalAgentsResponse } from "@/features/external-agents/lib/types";

export const runtime = "nodejs";

const exec = promisify(execCallback);

export async function GET(): Promise<NextResponse<ExternalAgentsResponse | { error: string }>> {
  try {
    const { stdout } = await exec("ps aux", { timeout: 5_000 });
    const agents = detectExternalAgentsFromPs(stdout, Date.now());
    return NextResponse.json<ExternalAgentsResponse>({
      agents,
      scannedAt: Date.now(),
    });
  } catch (err) {
    console.error("[external-agents] ps aux failed:", err);
    return NextResponse.json(
      { error: "Failed to scan processes" },
      { status: 500 },
    );
  }
}
