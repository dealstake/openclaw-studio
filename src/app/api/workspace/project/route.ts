import { NextResponse } from "next/server";

import {
  writeWorkspaceFile,
  resolveWorkspacePath,
} from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet, sidecarMutate } from "@/lib/workspace/sidecar";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { updateRowStatus, removeRow } from "@/features/projects/lib/indexTable";
import { readIndexContent, writeIndexContent } from "@/lib/workspace/indexFile";
import { getDb } from "@/lib/database";
import * as projectsRepo from "@/lib/database/repositories/projectsRepo";
import { generateIndexMarkdown } from "@/lib/database/sync/indexSync";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validateRequest(agentId: string, doc: string): NextResponse | null {
  const v = validateAgentId(agentId);
  if (!v.ok) return v.error;
  if (!doc) {
    return NextResponse.json({ error: "Missing required field: doc" }, { status: 400 });
  }
  return null;
}

/**
 * Update a project's status in INDEX.md via sidecar (Cloud Run path).
 * Reads INDEX.md, applies the status change, writes it back.
 */
async function updateStatusViaSidecar(
  agentId: string,
  doc: string,
  newStatus: string,
): Promise<NextResponse> {
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
}

/**
 * Delete (archive) a project via sidecar (Cloud Run path).
 * Removes from INDEX.md and copies the file to projects/archive/.
 */
async function deleteViaSidecar(agentId: string, doc: string): Promise<NextResponse> {
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

  return NextResponse.json({ ok: true, doc, archived: true });
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

    // Sidecar mode (Cloud Run) — update via INDEX.md text parsing
    if (isSidecarConfigured()) {
      return updateStatusViaSidecar(agentId, doc, newStatus);
    }

    // DB mode (local) — SQL update + INDEX.md regeneration
    const db = getDb();
    const found = projectsRepo.updateStatus(db, doc, newStatus);
    if (!found) {
      return NextResponse.json({ error: `Project with doc "${doc}" not found` }, { status: 404 });
    }

    const markdown = generateIndexMarkdown(db);
    writeWorkspaceFile(agentId, "projects/INDEX.md", markdown);

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

    // Sidecar mode (Cloud Run)
    if (isSidecarConfigured()) {
      return deleteViaSidecar(agentId, doc);
    }

    // DB mode (local) — transactional delete + archive
    const db = getDb();

    const existing = projectsRepo.getByDoc(db, doc);
    if (!existing) {
      return NextResponse.json({ error: `Project with doc "${doc}" not found` }, { status: 404 });
    }

    db.transaction((tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tx has same query API as db
      const txDb = tx as any;
      projectsRepo.remove(txDb, doc);
      const markdown = generateIndexMarkdown(txDb);
      writeWorkspaceFile(agentId, "projects/INDEX.md", markdown);
    });

    // Move file to archive (outside transaction — file ops can't be rolled back)
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
  } catch (err) {
    return handleApiError(err, "project DELETE");
  }
}
