import { NextResponse } from "next/server";

import {
  writeWorkspaceFile,
  resolveWorkspacePath,
} from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarMutate } from "@/lib/workspace/sidecar";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as projectsRepo from "@/lib/database/repositories/projectsRepo";
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

// ─── POST — Create a new project ────────────────────────────────────────────

/**
 * POST /api/workspace/project
 * Body: { agentId, name, doc, status, priority, oneLiner, content? }
 *
 * Creates a project row in the DB. If `content` is provided, writes the
 * project .md file as well.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      agentId?: string;
      name?: string;
      doc?: string;
      status?: string;
      priority?: string;
      oneLiner?: string;
      content?: string;
    };
    const agentId = body.agentId?.trim() ?? "";
    const doc = body.doc?.trim() ?? "";
    const name = body.name?.trim() ?? "";
    const status = body.status?.trim() ?? "📋 Defined";
    const priority = body.priority?.trim() ?? "🟢 P2";
    const oneLiner = body.oneLiner?.trim() ?? "";

    const validationError = validateRequest(agentId, doc);
    if (validationError) return validationError;
    if (!name) {
      return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });
    }

    // Extract emojis
    const statusEmoji = status.match(/^(🚧|🔨|📋|🌊|⏸️|✅)/)?.[1] ?? "";
    const priorityEmoji = priority.match(/^(🔴|🟡|🟢)/)?.[1] ?? "";

    if (isSidecarConfigured()) {
      // Cloud Run: proxy to sidecar
      const res = await sidecarMutate("/workspace/project", "POST", {
        agentId,
        name,
        doc,
        status,
        priority,
        oneLiner,
        content: body.content,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        return NextResponse.json(
          { error: data.error || `Sidecar create failed: ${res.status}` },
          { status: res.status },
        );
      }
      return NextResponse.json({ ok: true, doc });
    }

    // Local mode: insert into DB
    const db = getDb();
    const existing = projectsRepo.getByDoc(db, doc);
    if (existing) {
      return NextResponse.json({ error: `Project "${doc}" already exists` }, { status: 409 });
    }

    projectsRepo.upsert(db, { name, doc, status, statusEmoji, priority, priorityEmoji, oneLiner });

    // Write project file if content provided
    if (body.content) {
      writeWorkspaceFile(agentId, `projects/${doc}`, body.content);
    }

    return NextResponse.json({ ok: true, doc });
  } catch (err) {
    return handleApiError(err, "project POST");
  }
}

// ─── PATCH — Update project status ──────────────────────────────────────────

/**
 * PATCH /api/workspace/project
 * Body: { agentId, doc, status }
 *
 * Updates a project's status in the DB.
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

    if (isSidecarConfigured()) {
      // Cloud Run: proxy to sidecar
      const res = await sidecarMutate("/workspace/project", "PATCH", {
        agentId,
        doc,
        status: newStatus,
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        return NextResponse.json(
          { error: data.error || `Sidecar update failed: ${res.status}` },
          { status: res.status },
        );
      }
      return NextResponse.json({ ok: true, doc, status: newStatus });
    }

    // DB mode (local) — SQL update only, no INDEX.md
    const db = getDb();
    const found = projectsRepo.updateStatus(db, doc, newStatus);
    if (!found) {
      return NextResponse.json({ error: `Project with doc "${doc}" not found` }, { status: 404 });
    }

    return NextResponse.json({ ok: true, doc, status: newStatus });
  } catch (err) {
    return handleApiError(err, "project PATCH");
  }
}

// ─── DELETE — Archive a project ──────────────────────────────────────────────

/**
 * DELETE /api/workspace/project
 * Body: { agentId, doc }
 *
 * Archives a project: removes from DB and moves the project file
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

    if (isSidecarConfigured()) {
      // Cloud Run: proxy to sidecar
      const res = await sidecarMutate("/workspace/project", "DELETE", { agentId, doc });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        return NextResponse.json(
          { error: data.error || `Sidecar delete failed: ${res.status}` },
          { status: res.status },
        );
      }
      return NextResponse.json({ ok: true, doc, archived: true });
    }

    // DB mode (local)
    const db = getDb();

    const existing = projectsRepo.getByDoc(db, doc);
    if (!existing) {
      return NextResponse.json({ error: `Project with doc "${doc}" not found` }, { status: 404 });
    }

    projectsRepo.remove(db, doc);

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
  } catch (err) {
    return handleApiError(err, "project DELETE");
  }
}
