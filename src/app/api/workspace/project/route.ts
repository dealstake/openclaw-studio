import { NextResponse } from "next/server";

import {
  isSafeAgentId,
  readWorkspaceFile,
  writeWorkspaceFile,
} from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet, sidecarMutate } from "@/lib/workspace/sidecar";

export const runtime = "nodejs";

/**
 * PATCH /api/workspace/project
 * Body: { agentId, doc, status }
 *
 * Updates a project's status in projects/INDEX.md.
 * `status` should be the full status string like "🔨 Active" or "⏸️ Parked".
 */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      agentId?: string;
      doc?: string;
      status?: string;
    };

    const agentId = body.agentId?.trim() ?? "";
    const doc = body.doc?.trim() ?? "";
    const newStatus = body.status?.trim() ?? "";

    if (!agentId || !doc || !newStatus) {
      return NextResponse.json(
        { error: "Missing required fields: agentId, doc, status" },
        { status: 400 }
      );
    }

    if (!isSafeAgentId(agentId)) {
      return NextResponse.json(
        { error: `Invalid agentId: ${agentId}` },
        { status: 400 }
      );
    }

    const indexPath = "projects/INDEX.md";

    // Read current INDEX.md
    let content: string;
    if (isSidecarConfigured()) {
      const res = await sidecarGet("/file", { agentId, path: indexPath });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Failed to read INDEX.md: ${res.status}` },
          { status: res.status }
        );
      }
      const data = (await res.json()) as { content?: string };
      content = data.content ?? "";
    } else {
      const result = readWorkspaceFile(agentId, indexPath);
      content = result.content ?? "";
    }

    if (!content) {
      return NextResponse.json(
        { error: "INDEX.md not found or empty" },
        { status: 404 }
      );
    }

    // Find and replace the status in the matching row
    const lines = content.split("\n");
    let found = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // Match table rows containing the doc filename
      const match = line.match(
        /^(\|\s*.+?\s*\|\s*)(.+?)(\s*\|\s*)(.+?)(\s*\|\s*.+?\s*\|\s*.+?\s*\|)$/
      );
      if (!match) continue;

      const docCell = match[2].trim();
      if (docCell !== doc) continue;

      // Replace the status column (column 3)
      lines[i] = `${match[1]}${match[2]}${match[3]}${newStatus}${match[5]}`;
      found = true;
      break;
    }

    if (!found) {
      return NextResponse.json(
        { error: `Project with doc "${doc}" not found in INDEX.md` },
        { status: 404 }
      );
    }

    const updatedContent = lines.join("\n");

    // Write back
    if (isSidecarConfigured()) {
      const res = await sidecarMutate("/file", "PUT", {
        agentId,
        path: indexPath,
        content: updatedContent,
      });
      if (!res.ok) {
        return NextResponse.json(
          { error: `Failed to write INDEX.md: ${res.status}` },
          { status: 500 }
        );
      }
    } else {
      writeWorkspaceFile(agentId, indexPath, updatedContent);
    }

    return NextResponse.json({ ok: true, doc, status: newStatus });
  } catch (err) {
    console.error("[project PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
