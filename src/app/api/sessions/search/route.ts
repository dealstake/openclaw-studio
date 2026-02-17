import { NextResponse } from "next/server";

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
    const agentId = url.searchParams.get("agentId")?.trim() ?? "";
    const query = url.searchParams.get("query")?.trim() ?? "";
    const limit = url.searchParams.get("limit") ?? "50";

    if (!agentId) {
      return NextResponse.json(
        { error: "Missing required query parameter: agentId" },
        { status: 400 }
      );
    }

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

    const resp = await sidecarGet("/sessions/search", { agentId, query, limit });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to search transcripts.";
    console.error("[sessions/search]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
