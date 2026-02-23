import { NextResponse } from "next/server";

import { readWorkspaceFile } from "@/lib/workspace/resolve";
import { isSidecarConfigured } from "@/lib/workspace/sidecar";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { readIndexContent, readProjectFileContent } from "@/lib/workspace/indexFile";
import { getDb } from "@/lib/database";
import * as projectsRepo from "@/lib/database/repositories/projectsRepo";
import { importFromMarkdown } from "@/lib/database/repositories/projectsRepo";
import * as projectDetailsRepo from "@/lib/database/repositories/projectDetailsRepo";
import { parseProjectFile } from "@/features/projects/lib/parseProject";

export const runtime = "nodejs";

/**
 * Cache TTL for project detail enrichment.
 *
 * Local mode: files are on disk, re-reads are cheap — 60 s is fine.
 * Sidecar mode (Cloud Run): each cache miss triggers an HTTP round-trip
 * to the Mac Mini through Cloudflare, so we use a longer TTL to avoid
 * N+1 sidecar calls on every poll.
 */
const LOCAL_CACHE_TTL_MS = 60_000;
const SIDECAR_CACHE_TTL_MS = 300_000;

/**
 * GET /api/workspace/projects?agentId=<id>
 *
 * Returns projects from the database, each enriched with parsed details
 * (continuation context, progress, linked tasks) in a single request.
 *
 * Both local and sidecar modes use the same DB-backed flow:
 *  1. Load project index from SQLite (auto-imports from INDEX.md on first call)
 *  2. Enrich each project with parsed details from the projectDetails cache
 *  3. On cache miss, read the project file (local disk or sidecar) and update cache
 *
 * This eliminates the previous N+1 sidecar fetch problem where Cloud Run
 * made 191 individual HTTP requests to the Mac Mini on every page load.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const db = getDb();
    const usingSidecar = isSidecarConfigured();
    const cacheTtl = usingSidecar ? SIDECAR_CACHE_TTL_MS : LOCAL_CACHE_TTL_MS;
    let rows = projectsRepo.listAll(db);

    // Auto-import from INDEX.md if DB is empty
    if (rows.length === 0) {
      let indexContent: string | null = null;

      if (usingSidecar) {
        const result = await readIndexContent(agentId);
        if (result.error) return result.error;
        indexContent = result.content;
      } else {
        indexContent = readWorkspaceFile(agentId, "projects/INDEX.md").content;
      }

      if (indexContent) {
        importFromMarkdown(db, indexContent);
        rows = projectsRepo.listAll(db);
      }
    }

    if (rows.length === 0) {
      return NextResponse.json({ projects: [] });
    }

    // Enrich with parsed project details, using DB cache to avoid redundant file reads.
    const now = Date.now();

    const enriched = await Promise.all(
      rows.map(async (project) => {
        try {
          // Check DB cache first — avoids file I/O (or sidecar HTTP) entirely
          const cached = projectDetailsRepo.getByDoc(db, project.doc);
          if (cached && now - new Date(cached.updatedAt).getTime() < cacheTtl) {
            return { ...project, details: projectDetailsRepo.toProjectDetails(cached) };
          }

          // Cache miss or stale — read project file via the appropriate backend
          const content = usingSidecar
            ? await readProjectFileContent(agentId, project.doc)
            : readWorkspaceFile(agentId, `projects/${project.doc}`).content ?? null;

          if (content) {
            // Parse and cache for future requests
            try {
              projectDetailsRepo.upsertFromMarkdown(db, project.doc, content);
            } catch {
              // Non-fatal: inline parsing still works
            }
            return { ...project, details: parseProjectFile(content) };
          }

          return project;
        } catch {
          return project;
        }
      }),
    );

    return NextResponse.json(
      { projects: enriched },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } },
    );
  } catch (err) {
    return handleApiError(err, "workspace/projects");
  }
}
// Workspace cleanup: 2026-02-23 — trigger fresh project cache
