import { NextResponse } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";

export const runtime = "nodejs";

/**
 * GET /api/sessions/transcripts?agentId=<id>
 *
 * List all session transcripts (active + archived JSONL files).
 * Proxies to sidecar endpoint GET /sessions/transcripts.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;

    if (!isSidecarConfigured()) {
      return NextResponse.json(
        { error: "Sidecar not configured" },
        { status: 503 }
      );
    }

    const page = url.searchParams.get("page") ?? "";
    const perPage = url.searchParams.get("perPage") ?? "";
    const params: Record<string, string> = { agentId: validation.agentId };
    if (page) params.page = page;
    if (perPage) params.perPage = perPage;
    const resp = await sidecarGet("/sessions/transcripts", params);
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    return handleApiError(err, "sessions/transcripts", "Failed to list transcripts.");
  }
}
