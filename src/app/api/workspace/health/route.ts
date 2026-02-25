import { NextResponse } from "next/server";

import { isSidecarConfigured, isSidecarHealthy } from "@/lib/workspace/sidecar";

export const runtime = "nodejs";

/**
 * GET /api/workspace/health
 *
 * Returns sidecar connectivity status.
 */
export async function GET() {
  if (!isSidecarConfigured()) {
    return NextResponse.json({
      configured: false,
      healthy: true,
      mode: "local",
    });
  }

  const healthy = await isSidecarHealthy();
  return NextResponse.json(
    {
      configured: true,
      healthy,
      mode: "sidecar",
    },
    { status: healthy ? 200 : 503 }
  );
}
