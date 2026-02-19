import { NextResponse } from "next/server";

import { readWorkspaceFile } from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { parseIndex } from "@/features/projects/lib/indexTable";
import { getDb } from "@/lib/database";
import * as projectsRepo from "@/lib/database/repositories/projectsRepo";
import { importFromMarkdown } from "@/lib/database/repositories/projectsRepo";

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
        // Enrich with file content in parallel
        const enriched = await Promise.all(
          rows.map(async (project) => {
            try {
              const result = readWorkspaceFile(agentId, `projects/${project.doc}`);
              return { ...project, fileContent: result.content ?? null };
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
    let indexContent: string | null = null;
    if (isSidecarConfigured()) {
      const res = await sidecarGet("/file", { agentId, path: "projects/INDEX.md" });
      if (!res.ok) {
        if (res.status === 404) return NextResponse.json({ projects: [] });
        return NextResponse.json({ error: `Failed to read INDEX.md: ${res.status}` }, { status: res.status });
      }
      const data = (await res.json()) as { content?: string };
      indexContent = data.content ?? null;
    } else {
      const result = readWorkspaceFile(agentId, "projects/INDEX.md");
      indexContent = result.content ?? null;
    }

    if (!indexContent) return NextResponse.json({ projects: [] });

    const parsed = parseIndex(indexContent);

    // Fetch all project file contents in parallel
    const enriched = await Promise.all(
      parsed.map(async (project) => {
        try {
          let content: string | null = null;
          if (isSidecarConfigured()) {
            const res = await sidecarGet("/file", { agentId, path: `projects/${project.doc}` });
            if (res.ok) {
              const data = (await res.json()) as { content?: string };
              content = data.content ?? null;
            }
          } else {
            const result = readWorkspaceFile(agentId, `projects/${project.doc}`);
            content = result.content ?? null;
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
  } catch (err) {
    return handleApiError(err, "workspace/projects");
  }
}
