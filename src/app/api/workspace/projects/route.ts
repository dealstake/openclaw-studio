import { NextResponse } from "next/server";

import { readWorkspaceFile } from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { parseIndex } from "@/features/projects/lib/indexTable";

export const runtime = "nodejs";

/**
 * GET /api/workspace/projects?agentId=<id>
 *
 * Returns INDEX.md parsed into project entries, each enriched with
 * its project file content in a single request (avoids N+1 fetches).
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    // 1. Read INDEX.md
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

    // 2. Fetch all project file contents in parallel
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

    return NextResponse.json({ projects: enriched });
  } catch (err) {
    return handleApiError(err, "workspace/projects");
  }
}
