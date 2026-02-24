import { readWorkspaceFile, resolveWorkspacePath } from "@/lib/workspace/resolve";
import { withSidecarGetFallback } from "@/lib/api/sidecar-proxy";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as projectsRepo from "@/lib/database/repositories/projectsRepo";
import * as projectDetailsRepo from "@/lib/database/repositories/projectDetailsRepo";
import { parseProjectFile } from "@/features/projects/lib/parseProject";
import fs from "fs";

export const runtime = "nodejs";

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

        // Enrich with parsed project details, using mtime-based cache invalidation.
        // Only re-reads files when they've been modified since the last cache write.
        const enriched = await Promise.all(
          rows.map(async (project) => {
            try {
              // Check file mtime on disk
              let fileMtimeMs: number | null = null;
              try {
                const { absolute: filePath } = resolveWorkspacePath(agentId, `projects/${project.doc}`);
                const stat = fs.statSync(filePath);
                fileMtimeMs = Math.floor(stat.mtimeMs);
              } catch {
                // File doesn't exist — use cached data if available
              }

              const cached = projectDetailsRepo.getByDoc(db, project.doc);

              // If cached mtime matches file mtime, serve from cache (zero file reads)
              if (cached && fileMtimeMs !== null && cached.fileMtimeMs === fileMtimeMs) {
                const planItems = projectDetailsRepo.getPlanItems(db, project.doc);
                return { ...project, details: projectDetailsRepo.toProjectDetails(cached, planItems) };
              }

              // File is newer or no cache — re-read and re-parse
              const content = readWorkspaceFile(agentId, `projects/${project.doc}`).content ?? null;
              if (content) {
                try {
                  projectDetailsRepo.upsertFromMarkdown(db, project.doc, content, fileMtimeMs ?? undefined);
                } catch {
                  // Non-fatal: inline parsing still works
                }
                return { ...project, details: parseProjectFile(content) };
              }

              // No file but have cache — return stale cache
              if (cached) {
                const planItems = projectDetailsRepo.getPlanItems(db, project.doc);
                return { ...project, details: projectDetailsRepo.toProjectDetails(cached, planItems) };
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
