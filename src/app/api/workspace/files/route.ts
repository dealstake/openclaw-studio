import { NextResponse } from "next/server";

import { isSafeAgentId, listWorkspaceDir } from "@/lib/workspace/resolve";

export const runtime = "nodejs";

/**
 * GET /api/workspace/files?agentId=<id>&path=<relative>
 *
 * List files and directories in an agent's workspace.
 * - `agentId` (required): the agent whose workspace to browse
 * - `path` (optional): relative path within workspace (default: root)
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

    console.error("[workspace/files]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
