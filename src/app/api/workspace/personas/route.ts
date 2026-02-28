import { NextResponse } from "next/server";
import { withSidecarGetFallback, withSidecarMutateFallback } from "@/lib/api/sidecar-proxy";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as personasRepo from "@/lib/database/repositories/personasRepo";
import { validateStatusTransition } from "@/features/personas/lib/personaService";
import type { PersonaStatus, PersonaCategory } from "@/features/personas/lib/personaTypes";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const VALID_STATUSES: PersonaStatus[] = ["draft", "configuring", "active", "paused", "archived"];
const VALID_CATEGORIES: PersonaCategory[] = [
  "sales", "admin", "support", "marketing", "hr", "finance", "legal", "operations",
];

function isValidStatus(s: string): s is PersonaStatus {
  return (VALID_STATUSES as string[]).includes(s);
}

function isValidCategory(c: string): c is PersonaCategory {
  return (VALID_CATEGORIES as string[]).includes(c);
}

// ---------------------------------------------------------------------------
// GET /api/workspace/personas?agentId=<id>[&status=<s>][&category=<c>]
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const status = url.searchParams.get("status");
    const category = url.searchParams.get("category");

    const sidecarParams: Record<string, string> = { agentId };
    if (status) sidecarParams.status = status;
    if (category) sidecarParams.category = category;

    return withSidecarGetFallback(
      "/workspace/personas",
      sidecarParams,
      () => {
        const db = getDb();
        let rows;
        if (status && isValidStatus(status)) {
          rows = personasRepo.listByStatus(db, status);
        } else if (category && isValidCategory(category)) {
          rows = personasRepo.listByCategory(db, category);
        } else {
          rows = personasRepo.listAll(db);
        }
        return { personas: rows };
      },
    );
  } catch (err) {
    return handleApiError(err, "personas");
  }
}

// ---------------------------------------------------------------------------
// POST /api/workspace/personas — Create a persona
// Body: { agentId, personaId, displayName, category, templateKey?, optimizationGoals? }
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentId, personaId, displayName, category, templateKey, optimizationGoals } = body;

    const validation = validateAgentId(agentId);
    if (!validation.ok) return validation.error;

    if (!personaId || typeof personaId !== "string") {
      return NextResponse.json({ error: "Missing required field: personaId" }, { status: 400 });
    }
    if (!displayName || typeof displayName !== "string") {
      return NextResponse.json({ error: "Missing required field: displayName" }, { status: 400 });
    }
    if (!category || !isValidCategory(category)) {
      return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 });
    }

    return withSidecarMutateFallback(
      "/workspace/personas",
      "POST",
      body,
      () => {
        const db = getDb();

        // Check for duplicate
        const existing = personasRepo.getById(db, personaId);
        if (existing) {
          throw new Error("Persona already exists");
        }

        personasRepo.create(db, {
          personaId,
          displayName,
          category,
          templateKey: templateKey ?? null,
          status: "draft",
          optimizationGoals: JSON.stringify(optimizationGoals ?? []),
          metricsJson: "{}",
          createdAt: new Date().toISOString(),
          lastTrainedAt: null,
          practiceCount: 0,
        });

        return { ok: true, personaId };
      },
    );
  } catch (err) {
    return handleApiError(err, "personas");
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/workspace/personas — Update a persona
// Body: { agentId, personaId, ...fields }
// ---------------------------------------------------------------------------

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { agentId, personaId, ...fields } = body;

    const validation = validateAgentId(agentId);
    if (!validation.ok) return validation.error;

    if (!personaId || typeof personaId !== "string") {
      return NextResponse.json({ error: "Missing required field: personaId" }, { status: 400 });
    }

    // Validate status if being changed
    if (fields.status && !isValidStatus(fields.status)) {
      return NextResponse.json({ error: `Invalid status: ${fields.status}` }, { status: 400 });
    }

    // Validate category if being changed
    if (fields.category && !isValidCategory(fields.category)) {
      return NextResponse.json({ error: `Invalid category: ${fields.category}` }, { status: 400 });
    }

    return withSidecarMutateFallback(
      "/workspace/personas",
      "PATCH",
      body,
      () => {
        const db = getDb();
        const existing = personasRepo.getById(db, personaId);
        if (!existing) {
          throw new Error("Persona not found");
        }

        // Validate status transition (throws on invalid)
        if (fields.status) {
          validateStatusTransition(
            existing.status as PersonaStatus,
            fields.status as PersonaStatus,
          );
        }

        // Build update fields
        const updateFields: Record<string, unknown> = {};
        if (fields.displayName !== undefined) updateFields.displayName = fields.displayName;
        if (fields.category !== undefined) updateFields.category = fields.category;
        if (fields.status !== undefined) updateFields.status = fields.status;
        if (fields.templateKey !== undefined) updateFields.templateKey = fields.templateKey;
        if (fields.optimizationGoals !== undefined) {
          updateFields.optimizationGoals = JSON.stringify(fields.optimizationGoals);
        }
        if (fields.metricsJson !== undefined) updateFields.metricsJson = fields.metricsJson;
        if (fields.practiceCount !== undefined) updateFields.practiceCount = fields.practiceCount;
        if (fields.lastTrainedAt !== undefined) updateFields.lastTrainedAt = fields.lastTrainedAt;

        personasRepo.update(db, personaId, updateFields);
        return { ok: true, personaId };
      },
    );
  } catch (err) {
    return handleApiError(err, "personas");
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/workspace/personas?agentId=<id>&personaId=<id>
// ---------------------------------------------------------------------------

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const personaId = url.searchParams.get("personaId");
    if (!personaId) {
      return NextResponse.json({ error: "Missing required param: personaId" }, { status: 400 });
    }

    return withSidecarMutateFallback(
      "/workspace/personas",
      "DELETE",
      { agentId, personaId },
      () => {
        const db = getDb();
        const existing = personasRepo.getById(db, personaId);
        if (!existing) {
          throw new Error("Persona not found");
        }

        personasRepo.remove(db, personaId);
        return { ok: true, personaId };
      },
    );
  } catch (err) {
    return handleApiError(err, "personas");
  }
}
