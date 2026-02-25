import { NextResponse } from "next/server";

import { readWorkspaceFile } from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";

export const runtime = "nodejs";

type FileResult = {
  path: string;
  content: string | null;
  error?: string;
};

/**
 * POST /api/workspace/files/batch
 *
 * Fetch multiple workspace files in a single request.
 * Body: { agentId: string, paths: string[] }
 * Response: { files: FileResult[] }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { agentId?: string; paths?: string[] };
    const validation = validateAgentId(body.agentId);
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const paths = body.paths;
    if (!Array.isArray(paths) || paths.length === 0) {
      return NextResponse.json({ error: "paths must be a non-empty array." }, { status: 400 });
    }
    if (paths.length > 50) {
      return NextResponse.json({ error: "Maximum 50 paths per request." }, { status: 400 });
    }

    const files: FileResult[] = await Promise.all(
      paths.map(async (filePath): Promise<FileResult> => {
        try {
          let content: string | null = null;
          if (isSidecarConfigured()) {
            const res = await sidecarGet("/file", { agentId, path: filePath });
            if (res.ok) {
              const data = (await res.json()) as { content?: string };
              content = data.content ?? null;
            } else if (res.status !== 404) {
              return { path: filePath, content: null, error: `HTTP ${res.status}` };
            }
          } else {
            const result = readWorkspaceFile(agentId, filePath);
            content = result.content ?? null;
          }
          return { path: filePath, content };
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          return { path: filePath, content: null, error: msg };
        }
      }),
    );

    return NextResponse.json(
      { files },
      { headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } },
    );
  } catch (err) {
    return handleApiError(err, "workspace/files/batch");
  }
}
