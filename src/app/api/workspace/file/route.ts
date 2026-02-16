import { NextResponse } from "next/server";

import {
  isSafeAgentId,
  isTextFile,
  readWorkspaceFile,
  writeWorkspaceFile,
} from "@/lib/workspace/resolve";

export const runtime = "nodejs";

/**
 * GET /api/workspace/file?agentId=<id>&path=<relative>
 *
 * Read a single file from an agent's workspace.
 * Returns content for text files, metadata-only for binary/large files.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const agentId = url.searchParams.get("agentId")?.trim() ?? "";
    const filePath = url.searchParams.get("path")?.trim() ?? "";

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

    if (!filePath) {
      return NextResponse.json(
        { error: "Missing required query parameter: path" },
        { status: 400 }
      );
    }

    const result = readWorkspaceFile(agentId, filePath);

    return NextResponse.json({
      agentId,
      path: result.path,
      content: result.content,
      size: result.size,
      updatedAt: result.updatedAt,
      isText: result.isText,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to read workspace file.";

    if (message.includes("not found")) {
      return NextResponse.json({ error: message }, { status: 404 });
    }

    if (
      message.includes("traversal") ||
      message.includes("escapes") ||
      message.includes("Invalid agentId") ||
      message.includes("not a file")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("[workspace/file]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PUT /api/workspace/file
 *
 * Write content to a file in the agent's workspace.
 * Body: { agentId, path, content }
 */
export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid request payload." },
        { status: 400 }
      );
    }

    const { agentId, path: filePath, content } = body as {
      agentId?: string;
      path?: string;
      content?: string;
    };

    const trimmedAgentId = typeof agentId === "string" ? agentId.trim() : "";
    const trimmedPath = typeof filePath === "string" ? filePath.trim() : "";

    if (!trimmedAgentId) {
      return NextResponse.json(
        { error: "Missing required field: agentId" },
        { status: 400 }
      );
    }

    if (!isSafeAgentId(trimmedAgentId)) {
      return NextResponse.json(
        { error: `Invalid agentId: ${trimmedAgentId}` },
        { status: 400 }
      );
    }

    if (!trimmedPath) {
      return NextResponse.json(
        { error: "Missing required field: path" },
        { status: 400 }
      );
    }

    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Missing required field: content (must be a string)" },
        { status: 400 }
      );
    }

    if (!isTextFile(trimmedPath)) {
      return NextResponse.json(
        { error: "Only text files can be written via this endpoint." },
        { status: 400 }
      );
    }

    const result = writeWorkspaceFile(trimmedAgentId, trimmedPath, content);

    return NextResponse.json({
      agentId: trimmedAgentId,
      path: result.path,
      size: result.size,
      ok: true,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to write workspace file.";

    if (
      message.includes("traversal") ||
      message.includes("escapes") ||
      message.includes("Invalid agentId")
    ) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    console.error("[workspace/file]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
