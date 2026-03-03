import { NextResponse } from "next/server";
import { withSidecarGetFallback, withSidecarMutateFallback } from "@/lib/api/sidecar-proxy";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as personasRepo from "@/lib/database/repositories/personasRepo";
import { validateStatusTransition } from "@/features/personas/lib/personaService";
import { indexKnowledgeDir } from "@/features/personas/lib/knowledgeService";
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
    return handleApiError(err, "personas-get");
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

    // Pre-check for duplicate before entering sidecar fallback
    const db = getDb();
    const existing = personasRepo.getById(db, personaId);
    if (existing) {
      return NextResponse.json({ error: "Persona already exists" }, { status: 409 });
    }

    return withSidecarMutateFallback(
      "/workspace/personas",
      "POST",
      body,
      () => {
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
          voiceProvider: "elevenlabs",
          voiceId: "Rachel",
          voiceModelId: "eleven_flash_v2_5",
          voiceStability: 0.5,
          voiceClarity: 0.75,
          voiceStyle: 0,
        });

        return { ok: true, personaId };
      },
    );
  } catch (err) {
    return handleApiError(err, "personas-post");
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

    // Pre-check existence
    const db = getDb();
    const existing = personasRepo.getById(db, personaId);
    if (!existing) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }

    // Validate status transition (throws on invalid)
    if (fields.status) {
      try {
        validateStatusTransition(
          existing.status as PersonaStatus,
          fields.status as PersonaStatus,
        );
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Invalid status transition" },
          { status: 400 },
        );
      }
    }

    return withSidecarMutateFallback(
      "/workspace/personas",
      "PATCH",
      body,
      () => {
        // Build update fields from whitelist
        const updatable = [
          "displayName", "category", "status", "templateKey",
          "metricsJson", "practiceCount", "lastTrainedAt",
          "voiceProvider", "voiceId", "voiceModelId",
          "voiceStability", "voiceClarity", "voiceStyle",
        ] as const;
        const updateFields: Record<string, unknown> = {};

        for (const key of updatable) {
          if (fields[key] !== undefined) {
            updateFields[key] = fields[key];
          }
        }
        if (fields.optimizationGoals !== undefined) {
          updateFields.optimizationGoals = JSON.stringify(fields.optimizationGoals);
        }

        personasRepo.update(db, personaId, updateFields);

        // Auto-index knowledge files when persona transitions to "active"
        if (fields.status === "active") {
          // Fire-and-forget: index knowledge dir asynchronously after response
          indexKnowledgeDir(validation.agentId, personaId).catch((err) => {
            console.error(
              `[personas] Auto-index knowledge for ${personaId} failed:`,
              err instanceof Error ? err.message : err,
            );
          });
        }

        return { ok: true, personaId };
      },
    );
  } catch (err) {
    return handleApiError(err, "personas-patch");
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

    // Pre-check existence
    const db = getDb();
    const existing = personasRepo.getById(db, personaId);
    if (!existing) {
      return NextResponse.json({ error: "Persona not found" }, { status: 404 });
    }

    return withSidecarMutateFallback(
      "/workspace/personas",
      "DELETE",
      { agentId, personaId },
      () => {
        personasRepo.remove(db, personaId);
        return { ok: true, personaId };
      },
    );
  } catch (err) {
    return handleApiError(err, "personas-delete");
  }
}
