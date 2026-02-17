import { NextResponse } from "next/server";

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
    const agentId = url.searchParams.get("agentId")?.trim() ?? "";

    if (!agentId) {
      return NextResponse.json(
        { error: "Missing required query parameter: agentId" },
        { status: 400 }
      );
    }

    if (!isSidecarConfigured()) {
      return NextResponse.json(
        { error: "Sidecar not configured" },
        { status: 503 }
      );
    }

    const resp = await sidecarGet("/sessions/transcripts", { agentId });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to list transcripts.";
    console.error("[sessions/transcripts]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
