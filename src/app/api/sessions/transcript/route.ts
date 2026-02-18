import { NextResponse } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";

export const runtime = "nodejs";

/**
 * GET /api/sessions/transcript?agentId=<id>&sessionId=<id>&offset=0&limit=100
 *
 * Fetch messages from a specific session transcript (active or archived).
 * Proxies to sidecar endpoint GET /sessions/transcript.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId")?.trim() ?? "";
    const offset = url.searchParams.get("offset") ?? "0";
    const limit = url.searchParams.get("limit") ?? "100";

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required query parameter: sessionId" },
        { status: 400 }
      );
    }

    if (!isSidecarConfigured()) {
      return NextResponse.json(
        { error: "Sidecar not configured" },
        { status: 503 }
      );
    }

    const resp = await sidecarGet("/sessions/transcript", {
      agentId: validation.agentId,
      sessionId,
      offset,
      limit,
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    return handleApiError(err, "sessions/transcript", "Failed to fetch transcript.");
  }
}
