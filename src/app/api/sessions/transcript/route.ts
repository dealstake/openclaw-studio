import { NextResponse } from "next/server";

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
    const agentId = url.searchParams.get("agentId")?.trim() ?? "";
    const sessionId = url.searchParams.get("sessionId")?.trim() ?? "";
    const offset = url.searchParams.get("offset") ?? "0";
    const limit = url.searchParams.get("limit") ?? "100";

    if (!agentId) {
      return NextResponse.json(
        { error: "Missing required query parameter: agentId" },
        { status: 400 }
      );
    }

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
      agentId,
      sessionId,
      offset,
      limit,
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to fetch transcript.";
    console.error("[sessions/transcript]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
