import { readWorkspaceFile } from "@/lib/workspace/resolve";
import { withSidecarGetFallback } from "@/lib/api/sidecar-proxy";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as projectsRepo from "@/lib/database/repositories/projectsRepo";
import * as projectDetailsRepo from "@/lib/database/repositories/projectDetailsRepo";
import { parseProjectFile } from "@/features/projects/lib/parseProject";

export const runtime = "nodejs";

/** Cache TTL for project detail enrichment (local mode only). */
const LOCAL_CACHE_TTL_MS = 60_000;

/**
 * GET /api/workspace/projects?agentId=<id>
 *
 * Returns projects from the database, each enriched with parsed details
 * (continuation context, progress, linked tasks) in a single request.
 *
 * Cloud Run (sidecar mode): proxies entirely to Mac Mini's DB-backed endpoint.
 * Local mode: reads from the pre-populated Mac Mini SQLite directly.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const result = await withSidecarGetFallback(
      "/workspace/projects",
      { agentId },
      async () => {
        const db = getDb();
        const rows = projectsRepo.listAll(db);

        if (rows.length === 0) {
          return { projects: [] };
        }

        // Enrich with parsed project details, using DB cache to avoid redundant file reads.
        const now = Date.now();

        const enriched = await Promise.all(
          rows.map(async (project) => {
            try {
              const cached = projectDetailsRepo.getByDoc(db, project.doc);
              if (cached && now - new Date(cached.updatedAt).getTime() < LOCAL_CACHE_TTL_MS) {
                return { ...project, details: projectDetailsRepo.toProjectDetails(cached) };
              }

              const content = readWorkspaceFile(agentId, `projects/${project.doc}`).content ?? null;
              if (content) {
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

        return { projects: enriched };
      },
    );

    result.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return result;
  } catch (err) {
    return handleApiError(err, "workspace/projects");
  }
}
