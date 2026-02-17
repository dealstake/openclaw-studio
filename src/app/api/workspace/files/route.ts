import { NextResponse } from "next/server";

import { isSafeAgentId, listWorkspaceDir } from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet, SidecarUnavailableError } from "@/lib/workspace/sidecar";

export const runtime = "nodejs";

/**
 * GET /api/workspace/files?agentId=<id>&path=<relative>
 *
 * List files and directories in an agent's workspace.
 * Proxies to sidecar when running on Cloud Run, falls back to local fs.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId")?.trim() ?? "";
    const relativePath = url.searchParams.get("path")?.trim() ?? "";

    if (!agentId) {
      return NextResponse.json(
        { error: "Missing required query parameter: agentId" },
        { status: 400 }
      );
    }

    if (!isSafeAgentId(agentId)) {
      return NextResponse.json(
        { error: `Invalid agentId: ${agentId}` },
        { status: 400 }
      );
    }

    // ─── Sidecar proxy ────────────────────────────────────────────────
    if (isSidecarConfigured()) {
      const resp = await sidecarGet("/files", { agentId, path: relativePath });
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }

    // ─── Local filesystem ─────────────────────────────────────────────
    const { entries, workspace } = listWorkspaceDir(agentId, relativePath);

    return NextResponse.json({
      agentId,
      path: relativePath || "/",
      workspace,
      entries,
      count: entries.length,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list workspace files.";

    if (
      message.includes("traversal") ||
      message.includes("escapes") ||
      message.includes("Invalid agentId")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (err instanceof SidecarUnavailableError) {
      return NextResponse.json(
        { error: err.message, code: "SIDECAR_UNAVAILABLE" },
        { status: 503 }
      );
    }

    console.error("[workspace/files]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
