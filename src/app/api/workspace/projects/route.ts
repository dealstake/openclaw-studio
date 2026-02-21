import { NextResponse } from "next/server";

import { readWorkspaceFile } from "@/lib/workspace/resolve";
import { isSidecarConfigured } from "@/lib/workspace/sidecar";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { parseIndex } from "@/features/projects/lib/indexTable";
import { readIndexContent, readProjectFileContent } from "@/lib/workspace/indexFile";
import { getDb } from "@/lib/database";
import * as projectsRepo from "@/lib/database/repositories/projectsRepo";
import { importFromMarkdown } from "@/lib/database/repositories/projectsRepo";
import * as projectDetailsRepo from "@/lib/database/repositories/projectDetailsRepo";

export const runtime = "nodejs";

/**
 * GET /api/workspace/projects?agentId=<id>
 *
 * Returns projects from the database, each enriched with
 * its project file content in a single request (avoids N+1 fetches).
 *
 * On first call (empty DB), imports from INDEX.md automatically.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    // Try DB first (local mode only — sidecar mode falls back to file parsing)
    if (!isSidecarConfigured()) {
      const db = getDb();
      let rows = projectsRepo.listAll(db);

      // Auto-import from INDEX.md if DB is empty
      if (rows.length === 0) {
        const result = readWorkspaceFile(agentId, "projects/INDEX.md");
        if (result.content) {
          importFromMarkdown(db, result.content);
          rows = projectsRepo.listAll(db);
        }
      }

      if (rows.length > 0) {
        // Enrich with file content, using DB cache when available to avoid N+1 file reads.
        const now = Date.now();
        const CACHE_TTL_MS = 60_000;

        const enriched = await Promise.all(
          rows.map(async (project) => {
            try {
              // Check if we have a fresh cached entry
              const cached = projectDetailsRepo.getByDoc(db, project.doc);
              if (cached && now - new Date(cached.updatedAt).getTime() < CACHE_TTL_MS) {
                return { ...project, fileContent: null, details: projectDetailsRepo.toProjectDetails(cached) };
              }

              // Cache miss or stale — read file and update cache
              const result = readWorkspaceFile(agentId, `projects/${project.doc}`);
              const content = result.content ?? null;
              if (content) {
                try {
                  projectDetailsRepo.upsertFromMarkdown(db, project.doc, content);
                } catch {
                  // Non-fatal: cache miss is fine, parsing still works inline
                }
              }
              return { ...project, fileContent: content };
            } catch {
              return { ...project, fileContent: null };
            }
          }),
        );

        return NextResponse.json({ projects: enriched }, {
          headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
        });
      }
    }

    // Sidecar fallback: parse INDEX.md directly (Cloud Run)
    const { content: indexContent, error: readError } = await readIndexContent(agentId);
    if (readError) return readError;
    if (!indexContent) return NextResponse.json({ projects: [] });

    const parsed = parseIndex(indexContent);

    // Fetch all project file contents in parallel
    const enriched = await Promise.all(
      parsed.map(async (project) => {
        try {
          const content = await readProjectFileContent(agentId, project.doc);
          return { ...project, fileContent: content };
        } catch {
          return { ...project, fileContent: null };
        }
      }),
    );

    return NextResponse.json({ projects: enriched }, {
      headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
    });
  } catch (err) {
    return handleApiError(err, "workspace/projects");
  }
}
