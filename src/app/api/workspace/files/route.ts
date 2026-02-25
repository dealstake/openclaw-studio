import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { withSidecarGetFallback } from "@/lib/api/sidecar-proxy";
import { listWorkspaceDir } from "@/lib/workspace/resolve";

export const runtime = "nodejs";

/**
 * GET /api/workspace/files?agentId=<id>&path=<relative>
 *
 * List files and directories in an agent's workspace.
 * Proxies to sidecar when running on Cloud Run, falls back to local fs.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const relativePath = url.searchParams.get("path")?.trim() ?? "";

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    return await withSidecarGetFallback("/files", { agentId, path: relativePath }, () => {
      const { entries, workspace } = listWorkspaceDir(agentId, relativePath);
      return {
        agentId,
        path: relativePath || "/",
        workspace,
        entries,
        count: entries.length,
      };
    });
  } catch (err) {
    return handleApiError(err, "workspace/files", "Failed to list workspace files.");
  }
}
