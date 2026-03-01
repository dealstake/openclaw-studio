/**
 * POST /api/personas/preflight
 *
 * Runs the preflight engine for a list of capability keys.
 * Checks skill installation, credentials, MCP servers, and system deps.
 *
 * Body: PreflightRequest
 *   { capabilities: string[], agentId?: string, validate?: boolean }
 *
 * Returns: PreflightResult
 *   { overall, capabilities[], checkedAt, expiresIn, agentId }
 *
 * The route bridges the server-side `gatewayRpc` transport to the
 * `preflightService`, which expects a GatewayClient-compatible interface.
 * A minimal shim is cast to GatewayClient — only the `call` method is used.
 */

import { NextResponse } from "next/server";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { gatewayRpc } from "@/lib/gateway/server-rpc";
import { runPreflight } from "@/features/personas/lib/preflightService";
import type { PreflightRequest, PreflightResult } from "@/features/personas/lib/preflightTypes";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Server-side GatewayClient shim
// ---------------------------------------------------------------------------

/**
 * Wrap gatewayRpc in a minimal object that satisfies the `call` method
 * signature used by credentialService / skillService / configMutation.
 *
 * The full GatewayClient class manages a persistent WebSocket connection.
 * For short-lived API route calls, gatewayRpc opens a fresh connection per
 * call — no persistent connection needed.
 */
function makeServerClient(): GatewayClient {
  return {
    call: <T = unknown>(method: string, params: unknown): Promise<T> =>
      gatewayRpc<T>(method, params),
  } as unknown as GatewayClient;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(
  request: Request,
): Promise<NextResponse<PreflightResult | { error: string }>> {
  let body: PreflightRequest;

  try {
    body = (await request.json()) as PreflightRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Validate input
  if (!Array.isArray(body.capabilities) || body.capabilities.length === 0) {
    return NextResponse.json(
      { error: "capabilities must be a non-empty array of strings." },
      { status: 400 },
    );
  }

  // Sanitize: only accept string capability keys
  const capabilities = body.capabilities.filter(
    (c): c is string => typeof c === "string" && c.trim().length > 0,
  );

  if (capabilities.length === 0) {
    return NextResponse.json(
      { error: "No valid capability keys provided." },
      { status: 400 },
    );
  }

  const agentId =
    typeof body.agentId === "string" && body.agentId.trim()
      ? body.agentId.trim()
      : undefined;

  const personaId =
    typeof body.personaId === "string" && body.personaId.trim()
      ? body.personaId.trim()
      : undefined;

  const validate = body.validate === true;

  try {
    const client = makeServerClient();
    const result = await runPreflight(client, capabilities, { validate, agentId, personaId });

    // Serve cached result with appropriate Cache-Control
    // The result itself contains expiresIn (ms) — map that to seconds for HTTP.
    const maxAgeSeconds = Math.floor(result.expiresIn / 1_000);
    const response = NextResponse.json(result);
    response.headers.set(
      "Cache-Control",
      `private, max-age=${maxAgeSeconds}, stale-while-revalidate=60`,
    );
    return response;
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Preflight check failed.";
    console.error("[personas/preflight POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
