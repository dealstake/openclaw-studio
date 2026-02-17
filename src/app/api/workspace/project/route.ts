import { NextResponse } from "next/server";

import {
  isSafeAgentId,
  readWorkspaceFile,
  writeWorkspaceFile,
  resolveWorkspacePath,
} from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet, sidecarMutate, SidecarUnavailableError } from "@/lib/workspace/sidecar";
import fs from "node:fs";
import path from "node:path";

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
    if (err instanceof SidecarUnavailableError) {
      return NextResponse.json(
        { error: err.message, code: "SIDECAR_UNAVAILABLE" },
        { status: 503 }
      );
    }
    console.error("[project PATCH]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspace/project
 * Body: { agentId, doc }
 *
 * Archives a project: removes its row from INDEX.md and moves the project file
 * to projects/archive/<doc>.
 */
export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as {
      agentId?: string;
      doc?: string;
    };

    const agentId = body.agentId?.trim() ?? "";
    const doc = body.doc?.trim() ?? "";

    if (!agentId || !doc) {
      return NextResponse.json(
        { error: "Missing required fields: agentId, doc" },
        { status: 400 }
      );
    }

    if (!isSafeAgentId(agentId)) {
      return NextResponse.json(
        { error: `Invalid agentId: ${agentId}` },
        { status: 400 }
      );
    }

    // Validate doc filename (no path traversal)
    if (doc.includes("/") || doc.includes("\\") || doc.includes("..")) {
      return NextResponse.json(
        { error: "Invalid doc filename" },
        { status: 400 }
      );
    }

    const indexPath = "projects/INDEX.md";

    // 1. Read INDEX.md and remove the project row
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

    const lines = content.split("\n");
    let found = false;
    const updatedLines = lines.filter((line) => {
      const match = line.match(
        /^\|\s*.+?\s*\|\s*(.+?)\s*\|\s*.+?\s*\|\s*.+?\s*\|\s*.+?\s*\|$/
      );
      if (match && match[1].trim() === doc) {
        found = true;
        return false; // Remove this line
      }
      return true;
    });

    if (!found) {
      return NextResponse.json(
        { error: `Project with doc "${doc}" not found in INDEX.md` },
        { status: 404 }
      );
    }

    const updatedContent = updatedLines.join("\n");

    // 2. Write updated INDEX.md
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

      // 3. Move file to archive via sidecar (read + write to archive + delete original)
      const fileRes = await sidecarGet("/file", {
        agentId,
        path: `projects/${doc}`,
      });
      if (fileRes.ok) {
        const fileData = (await fileRes.json()) as { content?: string };
        if (fileData.content) {
          // Write to archive location
          await sidecarMutate("/file", "PUT", {
            agentId,
            path: `projects/archive/${doc}`,
            content: fileData.content,
          });
          // Delete original by writing empty — sidecar doesn't have DELETE,
          // so we rely on the file being in archive as the canonical copy.
          // The original stays but is removed from INDEX.md so it won't appear.
        }
      }
    } else {
      writeWorkspaceFile(agentId, indexPath, updatedContent);

      // 3. Move file to projects/archive/
      try {
        const { absolute: srcPath } = resolveWorkspacePath(
          agentId,
          `projects/${doc}`
        );
        const { absolute: destPath } = resolveWorkspacePath(
          agentId,
          `projects/archive/${doc}`
        );
        if (fs.existsSync(srcPath)) {
          const destDir = path.dirname(destPath);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          fs.renameSync(srcPath, destPath);
        }
      } catch (moveErr) {
        // Non-fatal: INDEX.md is already updated, file move is best-effort
        console.warn("[project DELETE] Failed to move file to archive:", moveErr);
      }
    }

    return NextResponse.json({ ok: true, doc, archived: true });
  } catch (err) {
    if (err instanceof SidecarUnavailableError) {
      return NextResponse.json(
        { error: err.message, code: "SIDECAR_UNAVAILABLE" },
        { status: 503 }
      );
    }
    console.error("[project DELETE]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
