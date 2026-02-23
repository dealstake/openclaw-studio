import { readWorkspaceFile } from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";

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
