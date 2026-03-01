import { NextResponse, type NextRequest } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { withSidecarGetFallback, withSidecarMutateFallback } from "@/lib/api/sidecar-proxy";
import { getDb } from "@/lib/database";
import * as orchestrationsRepo from "@/lib/database/repositories/orchestrationsRepo";
import type { Orchestration } from "@/features/orchestrator/lib/types";

export const runtime = "nodejs";

// ─── GET /api/orchestrations?agentId=<id> ────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const validation = validateAgentId(request.nextUrl.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const result = await withSidecarGetFallback("/orchestrations", { agentId }, () => {
      const db = getDb();
      const orchs = orchestrationsRepo.listByAgent(db, agentId);
      return { orchestrations: orchs };
    });

    result.headers.set("Cache-Control", "private, max-age=10, stale-while-revalidate=30");
    return result;
  } catch (err) {
    return handleApiError(err, "orchestrations");
  }
}

// ─── POST /api/orchestrations — Create or replace an orchestration ────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { orchestration } = body as { orchestration?: Orchestration };
    if (!orchestration?.id || !orchestration?.agentId || !orchestration?.name) {
      return NextResponse.json(
        { error: "orchestration.id, agentId, and name are required." },
        { status: 400 },
      );
    }

    return await withSidecarMutateFallback(
      "/orchestrations",
      "POST",
      { orchestration },
      () => {
        const db = getDb();
        orchestrationsRepo.upsert(db, orchestration);
        // Re-fetch to include DB-generated timestamps
        const saved = orchestrationsRepo.getById(db, orchestration.id);
        return { orchestration: saved ?? orchestration };
      },
    );
  } catch (err) {
    return handleApiError(err, "orchestrations");
  }
}

// ─── PATCH /api/orchestrations — Partial update ───────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { id, patch } = body as {
      id?: string;
      patch?: Partial<Pick<Orchestration, "name" | "description" | "graph" | "status" | "lastRunAt" | "lastRunStatus" | "runCount">>;
    };

    if (!id?.trim()) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }
    if (!patch || typeof patch !== "object") {
      return NextResponse.json({ error: "patch is required." }, { status: 400 });
    }

    return await withSidecarMutateFallback(
      "/orchestrations",
      "PATCH",
      { id, patch },
      () => {
        const db = getDb();
        const updated = orchestrationsRepo.patch(db, id, patch);
        if (!updated) {
          return NextResponse.json({ error: "Orchestration not found." }, { status: 404 });
        }
        return { orchestration: updated };
      },
    );
  } catch (err) {
    return handleApiError(err, "orchestrations");
  }
}

// ─── DELETE /api/orchestrations — Delete an orchestration ─────────────────────

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { id, agentId } = body as { id?: string; agentId?: string };

    if (!id?.trim()) {
      return NextResponse.json({ error: "id is required." }, { status: 400 });
    }
    if (!agentId?.trim()) {
      return NextResponse.json({ error: "agentId is required." }, { status: 400 });
    }

    return await withSidecarMutateFallback(
      "/orchestrations",
      "DELETE",
      { id, agentId },
      () => {
        const db = getDb();
        orchestrationsRepo.deleteById(db, id);
        return { ok: true };
      },
    );
  } catch (err) {
    return handleApiError(err, "orchestrations");
  }
}
