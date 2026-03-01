/**
 * POST /api/personas/[personaId]/health
 *
 * Runs a health-check preflight for a specific persona, deriving the
 * capability list from the persona's PERSONA.md "## Skill Requirements"
 * section. Writes the result to PERSONA.md YAML frontmatter for persistence.
 *
 * GET /api/personas/[personaId]/health
 *
 * Returns the last stored preflight result from PERSONA.md frontmatter.
 * Returns 204 when no stored result exists.
 *
 * Both routes accept an optional `validate=true` query param to trigger
 * live credential validation (may hit third-party APIs).
 */

import { NextResponse } from "next/server";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { gatewayRpc } from "@/lib/gateway/server-rpc";
import { runPreflight } from "@/features/personas/lib/preflightService";
import { CAPABILITY_SKILL_MAP } from "@/features/personas/lib/skillWiring";
import {
  readPersonaCapabilityKeys,
  readPreflightFrontmatter,
  writePreflightFrontmatter,
} from "@/features/personas/lib/personaMdFrontmatter";
import type { PreflightResult } from "@/features/personas/lib/preflightTypes";
import type { PersonaPreflightFrontmatter } from "@/features/personas/lib/personaMdFrontmatter";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Shared: server GatewayClient shim
// ---------------------------------------------------------------------------

function makeServerClient(): GatewayClient {
  return {
    call: <T = unknown>(method: string, params: unknown): Promise<T> =>
      gatewayRpc<T>(method, params),
  } as unknown as GatewayClient;
}

// ---------------------------------------------------------------------------
// Validate personaId
// ---------------------------------------------------------------------------

function isValidPersonaId(id: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(id);
}

// ---------------------------------------------------------------------------
// GET — return stored result
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ personaId: string }> },
): Promise<NextResponse<PreflightResult | { error: string } | null>> {
  const { personaId } = await params;

  if (!isValidPersonaId(personaId)) {
    return NextResponse.json({ error: "Invalid personaId." }, { status: 400 });
  }

  const stored = await readPreflightFrontmatter(personaId);
  if (!stored) {
    // No stored result — return 204
    return new NextResponse(null, { status: 204 });
  }

  // Reconstruct a minimal PreflightResult from frontmatter
  const result: PreflightResult = {
    overall: stored.preflight_status,
    checkedAt: stored.preflight_checked_at,
    expiresIn: 0, // already expired — serves as "last known"
    capabilities: stored.preflight_capabilities.map((cap: PersonaPreflightFrontmatter["preflight_capabilities"][number]) => ({
      capability: cap.capability,
      displayName: cap.display_name,
      required: cap.required,
      status: cap.status as PreflightResult["capabilities"][number]["status"],
      details: "",
    })),
  };

  return NextResponse.json(result);
}

// ---------------------------------------------------------------------------
// POST — run health check
// ---------------------------------------------------------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ personaId: string }> },
): Promise<NextResponse<PreflightResult | { error: string }>> {
  const { personaId } = await params;

  if (!isValidPersonaId(personaId)) {
    return NextResponse.json({ error: "Invalid personaId." }, { status: 400 });
  }

  const url = new URL(request.url);
  const validate = url.searchParams.get("validate") === "true";

  // Derive capabilities from PERSONA.md Skill Requirements section
  const capabilities = await readPersonaCapabilityKeys(personaId, CAPABILITY_SKILL_MAP);

  // If no capabilities found, check a minimal baseline set
  // (ensures even from-scratch personas get a useful result)
  const toCheck =
    capabilities.length > 0
      ? capabilities
      : ["web_search"]; // baseline: web research is always relevant

  try {
    const client = makeServerClient();
    const result = await runPreflight(client, toCheck, {
      validate,
      agentId: personaId,
      personaId,
    });

    // Persist result to PERSONA.md frontmatter
    try {
      await writePreflightFrontmatter(personaId, result);
    } catch (writeErr) {
      // Non-fatal — log but don't fail the response
      console.error(
        `[personas/${personaId}/health] Failed to write frontmatter:`,
        writeErr instanceof Error ? writeErr.message : writeErr,
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Health check failed.";
    console.error(`[personas/${personaId}/health POST]`, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
