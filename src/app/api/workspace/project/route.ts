import { NextResponse } from "next/server";

import {
  readWorkspaceFile,
  writeWorkspaceFile,
  resolveWorkspacePath,
} from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet, sidecarMutate } from "@/lib/workspace/sidecar";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { updateRowStatus, removeRow } from "@/features/projects/lib/indexTable";
import { getDb } from "@/lib/database";
import * as projectsRepo from "@/lib/database/repositories/projectsRepo";
import { generateIndexMarkdown } from "@/lib/database/sync/indexSync";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

// ─── Helpers (sidecar fallback) ──────────────────────────────────────────────

async function readIndexContent(agentId: string): Promise<{ content: string | null; error?: NextResponse }> {
  const indexPath = "projects/INDEX.md";
  if (isSidecarConfigured()) {
    const res = await sidecarGet("/file", { agentId, path: indexPath });
    if (!res.ok) {
      return { content: null, error: NextResponse.json({ error: `Failed to read INDEX.md: ${res.status}` }, { status: res.status }) };
    }
    const data = (await res.json()) as { content?: string };
    return { content: data.content ?? "" };
  }
  const result = readWorkspaceFile(agentId, indexPath);
  return { content: result.content ?? "" };
}

async function writeIndexContent(agentId: string, content: string): Promise<NextResponse | null> {
  const indexPath = "projects/INDEX.md";
  if (isSidecarConfigured()) {
    const res = await sidecarMutate("/file", "PUT", { agentId, path: indexPath, content });
    if (!res.ok) {
      return NextResponse.json({ error: `Failed to write INDEX.md: ${res.status}` }, { status: 500 });
    }
    return null;
  }
  writeWorkspaceFile(agentId, indexPath, content);
  return null;
}

function validateRequest(agentId: string, doc: string): NextResponse | null {
  const v = validateAgentId(agentId);
  if (!v.ok) return v.error;
  if (!doc) {
    return NextResponse.json({ error: "Missing required field: doc" }, { status: 400 });
  }
  return null;
}

// ─── PATCH ───────────────────────────────────────────────────────────────────

/**
 * PATCH /api/workspace/project
 * Body: { agentId, doc, status }
 *
 * Updates a project's status. Uses DB when available, falls back to file parsing.
 * Always regenerates INDEX.md for agent readability.
 */
export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { agentId?: string; doc?: string; status?: string };
    const agentId = body.agentId?.trim() ?? "";
    const doc = body.doc?.trim() ?? "";
    const newStatus = body.status?.trim() ?? "";

    if (!newStatus) {
      return NextResponse.json({ error: "Missing required field: status" }, { status: 400 });
    }

    const validationError = validateRequest(agentId, doc);
    if (validationError) return validationError;

    // DB path (local mode)
    if (!isSidecarConfigured()) {
      const db = getDb();
      const found = projectsRepo.updateStatus(db, doc, newStatus);
      if (!found) {
        return NextResponse.json({ error: `Project with doc "${doc}" not found` }, { status: 404 });
      }

      // Regenerate INDEX.md for agent readability
      const markdown = generateIndexMarkdown(db);
      writeWorkspaceFile(agentId, "projects/INDEX.md", markdown);

      return NextResponse.json({ ok: true, doc, status: newStatus });
    }

    // Sidecar fallback (Cloud Run)
    const { content, error: readError } = await readIndexContent(agentId);
    if (readError) return readError;
    if (!content) {
      return NextResponse.json({ error: "INDEX.md not found or empty" }, { status: 404 });
    }

    const { content: updated, found } = updateRowStatus(content, doc, newStatus);
    if (!found) {
      return NextResponse.json({ error: `Project with doc "${doc}" not found in INDEX.md` }, { status: 404 });
    }

    const writeError = await writeIndexContent(agentId, updated);
    if (writeError) return writeError;

    return NextResponse.json({ ok: true, doc, status: newStatus });
  } catch (err) {
    return handleApiError(err, "project PATCH");
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

/**
 * DELETE /api/workspace/project
 * Body: { agentId, doc }
 *
 * Archives a project: removes from DB/INDEX.md and moves the project file
 * to projects/archive/<doc>.
 */
export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { agentId?: string; doc?: string };
    const agentId = body.agentId?.trim() ?? "";
    const doc = body.doc?.trim() ?? "";

    const validationError = validateRequest(agentId, doc);
    if (validationError) return validationError;

    // Validate doc filename (no path traversal)
    if (doc.includes("/") || doc.includes("\\") || doc.includes("..")) {
      return NextResponse.json({ error: "Invalid doc filename" }, { status: 400 });
    }

    // DB path (local mode)
    if (!isSidecarConfigured()) {
      const db = getDb();
      const found = projectsRepo.remove(db, doc);
      if (!found) {
        return NextResponse.json({ error: `Project with doc "${doc}" not found` }, { status: 404 });
      }

      // Regenerate INDEX.md
      const markdown = generateIndexMarkdown(db);
      writeWorkspaceFile(agentId, "projects/INDEX.md", markdown);

      // Move file to archive
      try {
        const { absolute: srcPath } = resolveWorkspacePath(agentId, `projects/${doc}`);
        const { absolute: destPath } = resolveWorkspacePath(agentId, `projects/archive/${doc}`);
        if (fs.existsSync(srcPath)) {
          const destDir = path.dirname(destPath);
          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }
          fs.renameSync(srcPath, destPath);
        }
      } catch (moveErr) {
        console.warn("[project DELETE] Failed to move file to archive:", moveErr);
      }

      return NextResponse.json({ ok: true, doc, archived: true });
    }

    // Sidecar fallback
    const { content, error: readError } = await readIndexContent(agentId);
    if (readError) return readError;
    if (!content) {
      return NextResponse.json({ error: "INDEX.md not found or empty" }, { status: 404 });
    }

    const { content: updated, found } = removeRow(content, doc);
    if (!found) {
      return NextResponse.json({ error: `Project with doc "${doc}" not found in INDEX.md` }, { status: 404 });
    }

    const writeError = await writeIndexContent(agentId, updated);
    if (writeError) return writeError;

    // Move file to archive via sidecar
    if (isSidecarConfigured()) {
      const fileRes = await sidecarGet("/file", { agentId, path: `projects/${doc}` });
      if (fileRes.ok) {
        const fileData = (await fileRes.json()) as { content?: string };
        if (fileData.content) {
          await sidecarMutate("/file", "PUT", {
            agentId,
            path: `projects/archive/${doc}`,
            content: fileData.content,
          });
          await sidecarMutate("/file", "PUT", {
            agentId,
            path: `projects/${doc}`,
            content: `<!-- Archived: moved to projects/archive/${doc} -->\n`,
          });
        }
      }
    }

    return NextResponse.json({ ok: true, doc, archived: true });
  } catch (err) {
    return handleApiError(err, "project DELETE");
  }
}
