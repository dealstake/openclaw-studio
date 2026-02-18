import { NextResponse } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";

export const runtime = "nodejs";

/**
 * GET /api/sessions/search?agentId=<id>&query=<text>&limit=50
 *
 * Full-text search across session transcripts.
 * Proxies to sidecar endpoint GET /sessions/search.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("query")?.trim() ?? "";
    const limit = url.searchParams.get("limit") ?? "50";

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;

    if (!query) {
      return NextResponse.json(
        { error: "Missing required query parameter: query" },
        { status: 400 }
      );
    }

    if (!isSidecarConfigured()) {
      return NextResponse.json(
        { error: "Sidecar not configured" },
        { status: 503 }
      );
    }

    const resp = await sidecarGet("/sessions/search", { agentId: validation.agentId, query, limit });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    return handleApiError(err, "sessions/search", "Failed to search transcripts.");
  }
}
