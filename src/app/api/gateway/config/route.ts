import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * GET /api/gateway/config
 *
 * Returns gateway connection config from runtime env vars.
 * This allows Cloud Run to inject GATEWAY_TOKEN and GATEWAY_URL
 * at deploy time without rebuilding the Docker image.
 *
 * Priority: Runtime env (GATEWAY_TOKEN) > Build-time (NEXT_PUBLIC_GATEWAY_TOKEN)
 */
export async function GET() {
  const token =
    process.env.GATEWAY_TOKEN ??
    process.env.NEXT_PUBLIC_GATEWAY_TOKEN ??
    "";

  const url =
    process.env.GATEWAY_URL ??
    process.env.NEXT_PUBLIC_GATEWAY_URL ??
    "ws://127.0.0.1:18789";

  return NextResponse.json(
    { url, token },
    {
      headers: {
        "Cache-Control": "private, max-age=60",
      },
    }
  );
}
