import { NextResponse } from "next/server";

import { readWorkspaceFile, writeWorkspaceFile } from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet, sidecarMutate } from "@/lib/workspace/sidecar";

const INDEX_PATH = "projects/INDEX.md";

/**
 * Read INDEX.md content, handling sidecar vs local branching.
 * Returns `{ content, error }` — check `error` first.
 */
export async function readIndexContent(
  agentId: string,
): Promise<{ content: string | null; error?: NextResponse }> {
  if (isSidecarConfigured()) {
    const res = await sidecarGet("/file", { agentId, path: INDEX_PATH });
    if (!res.ok) {
      return {
        content: null,
        error: NextResponse.json(
          { error: `Failed to read INDEX.md: ${res.status}` },
          { status: res.status },
        ),
      };
    }
    const data = (await res.json()) as { content?: string };
    return { content: data.content ?? "" };
  }
  const result = readWorkspaceFile(agentId, INDEX_PATH);
  return { content: result.content ?? "" };
}

/**
 * Write INDEX.md content, handling sidecar vs local branching.
 * Returns a NextResponse error on failure, or null on success.
 */
export async function writeIndexContent(
  agentId: string,
  content: string,
): Promise<NextResponse | null> {
  if (isSidecarConfigured()) {
    const res = await sidecarMutate("/file", "PUT", {
      agentId,
      path: INDEX_PATH,
      content,
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to write INDEX.md: ${res.status}` },
        { status: 500 },
      );
    }
    return null;
  }
  writeWorkspaceFile(agentId, INDEX_PATH, content);
  return null;
}

/**
 * Read a project file's content, handling sidecar vs local branching.
 * Returns the file content string or null if not found.
 */
export async function readProjectFileContent(
  agentId: string,
  doc: string,
): Promise<string | null> {
  if (isSidecarConfigured()) {
    const res = await sidecarGet("/file", { agentId, path: `projects/${doc}` });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: string };
    return data.content ?? null;
  }
  const result = readWorkspaceFile(agentId, `projects/${doc}`);
  return result.content ?? null;
}
