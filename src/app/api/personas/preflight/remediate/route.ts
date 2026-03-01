/**
 * POST /api/personas/preflight/remediate
 *
 * Attempts auto-remediation for a previously-returned PreflightResult.
 *
 * Body: RemediationRequest
 *   {
 *     preflightResult: PreflightResult,   // the result from /api/personas/preflight
 *     confirmedCapabilities: string[],    // capabilities user has confirmed to install
 *     agentId?: string
 *   }
 *
 * Returns: RemediationResult
 *   { outcomes: RemediationOutcome[], updatedPreflight: PreflightResult }
 *
 * Security mandate
 * ────────────────
 * `install_skill` (ClawHub) and `install_mcp` (mcporter) actions ONLY run if
 * the capability key is present in `confirmedCapabilities`. This ensures the
 * user has explicitly clicked an "Install" button in the UI before any package
 * install runs. `enable_skill` is always safe and runs without confirmation.
 */

import { NextResponse } from "next/server";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { gatewayRpc } from "@/lib/gateway/server-rpc";
import { autoRemediate } from "@/features/personas/lib/preflightService";
import type {
  RemediationRequest,
  RemediationResult,
} from "@/features/personas/lib/preflightTypes";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Server-side GatewayClient shim (same pattern as preflight route)
// ---------------------------------------------------------------------------

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
): Promise<NextResponse<RemediationResult | { error: string }>> {
  let body: RemediationRequest;

  try {
    body = (await request.json()) as RemediationRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Validate preflightResult
  if (
    !body.preflightResult ||
    !Array.isArray(body.preflightResult.capabilities)
  ) {
    return NextResponse.json(
      { error: "preflightResult must be a valid PreflightResult object." },
      { status: 400 },
    );
  }

  // confirmedCapabilities must be an array (can be empty for enable_skill-only runs)
  if (!Array.isArray(body.confirmedCapabilities)) {
    return NextResponse.json(
      { error: "confirmedCapabilities must be an array of capability keys." },
      { status: 400 },
    );
  }

  // Sanitize: only accept string capability keys to prevent injection
  const confirmedCapabilities = body.confirmedCapabilities.filter(
    (c): c is string => typeof c === "string" && c.trim().length > 0,
  );

  const agentId =
    typeof body.agentId === "string" && body.agentId.trim()
      ? body.agentId.trim()
      : undefined;

  try {
    const client = makeServerClient();
    const result = await autoRemediate(client, body.preflightResult, {
      confirmedCapabilities,
      agentId,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Remediation failed.";
    console.error("[personas/preflight/remediate POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
