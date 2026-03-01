/**
 * /api/workspace/contact
 *
 * GET    ?agentId=X&id=Y   — fetch contact detail with recent interactions
 * POST   {agentId, ...}    — create or update a contact (dedup by email)
 * DELETE {agentId, id}     — soft-delete a contact
 *
 * Cloud Run (sidecar mode): proxies to Mac Mini's DB-backed endpoint.
 * Local mode: Drizzle against local studio.db.
 */

import { NextResponse } from "next/server";

import { withSidecarGetFallback, withSidecarMutateFallback } from "@/lib/api/sidecar-proxy";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as contactsRepo from "@/lib/database/repositories/contactsRepo";
import type { ContactInput } from "@/lib/database/repositories/contactsRepo";

export const runtime = "nodejs";

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const id = url.searchParams.get("id");
    if (!id?.trim()) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const result = await withSidecarGetFallback(
      "/workspace/contact",
      { agentId, id },
      () => {
        const db  = getDb();
        const row = contactsRepo.getContact(db, agentId, id);
        if (!row) throw new Error(`Contact ${id} not found`);
        return { contact: row };
      },
    );

    result.headers.set("Cache-Control", "private, max-age=15, stale-while-revalidate=30");
    return result;
  } catch (err) {
    return handleApiError(err, "workspace/contact GET");
  }
}

// ─── POST ────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const validation = validateAgentId(
      typeof body.agentId === "string" ? body.agentId : null,
    );
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const name = body.name;
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    // Build ContactInput — accept any additional fields from the body
    const input: ContactInput = {
      id:        typeof body.id        === "string" ? body.id        : undefined,
      personaId: typeof body.personaId === "string" ? body.personaId : null,
      name:      name.trim(),
      email:     typeof body.email     === "string" ? body.email     : null,
      phone:     typeof body.phone     === "string" ? body.phone     : null,
      company:   typeof body.company   === "string" ? body.company   : null,
      title:     typeof body.title     === "string" ? body.title     : null,
      tags:      body.tags as string | string[] | null | undefined,
      stage:     typeof body.stage     === "string" ? body.stage     : null,
      notes:     typeof body.notes     === "string" ? body.notes     : null,
      metadata:  body.metadata as string | Record<string, unknown> | null | undefined,
    };

    return withSidecarMutateFallback(
      "/workspace/contact",
      "POST",
      { agentId, ...input },
      () => {
        const db      = getDb();
        const contact = contactsRepo.upsertContact(db, agentId, input);
        return { ok: true, contact };
      },
    );
  } catch (err) {
    return handleApiError(err, "workspace/contact POST");
  }
}

// ─── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const validation = validateAgentId(
      typeof body.agentId === "string" ? body.agentId : null,
    );
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const id = body.id;
    if (typeof id !== "string" || !id.trim()) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    return withSidecarMutateFallback(
      "/workspace/contact",
      "DELETE",
      { agentId, id: id.trim() },
      () => {
        const db      = getDb();
        const deleted = contactsRepo.deleteContact(db, agentId, id.trim());
        if (!deleted) throw new Error(`Contact ${id} not found`);
        return { ok: true };
      },
    );
  } catch (err) {
    return handleApiError(err, "workspace/contact DELETE");
  }
}
