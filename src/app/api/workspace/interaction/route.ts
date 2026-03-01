/**
 * POST /api/workspace/interaction
 *
 * Log an interaction for a contact.
 *
 * Body:
 *   agentId      — required
 *   contactId    — required
 *   personaId    — required
 *   type         — required; "call" | "email" | "meeting" | "note" | "task"
 *   channel      — optional; "phone" | "email" | "whatsapp" | "in-person"
 *   summary      — optional
 *   content      — optional; full content (transcript, email body, etc.)
 *   outcome      — optional; "positive" | "neutral" | "negative" | "no-answer"
 *   artifactLink — optional; link to generated doc, recording, etc.
 *   id           — optional; client-generated ID for idempotency
 *
 * Cloud Run (sidecar mode): proxies to Mac Mini's DB-backed endpoint.
 * Local mode: Drizzle against local studio.db.
 */

import { NextResponse } from "next/server";

import { withSidecarMutateFallback } from "@/lib/api/sidecar-proxy";
import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import { getDb } from "@/lib/database";
import * as contactsRepo from "@/lib/database/repositories/contactsRepo";
import type { InteractionInput } from "@/lib/database/repositories/contactsRepo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const validation = validateAgentId(
      typeof body.agentId === "string" ? body.agentId : null,
    );
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const contactId = body.contactId;
    if (typeof contactId !== "string" || !contactId.trim()) {
      return NextResponse.json({ error: "contactId is required" }, { status: 400 });
    }

    const personaId = body.personaId;
    if (typeof personaId !== "string" || !personaId.trim()) {
      return NextResponse.json({ error: "personaId is required" }, { status: 400 });
    }

    const type = body.type;
    if (typeof type !== "string" || !type.trim()) {
      return NextResponse.json({ error: "type is required" }, { status: 400 });
    }

    const input: InteractionInput = {
      id:           typeof body.id           === "string" ? body.id           : undefined,
      contactId:    contactId.trim(),
      personaId:    personaId.trim(),
      type:         type.trim(),
      channel:      typeof body.channel      === "string" ? body.channel      : null,
      summary:      typeof body.summary      === "string" ? body.summary      : null,
      content:      typeof body.content      === "string" ? body.content      : null,
      outcome:      typeof body.outcome      === "string" ? body.outcome      : null,
      artifactLink: typeof body.artifactLink === "string" ? body.artifactLink : null,
    };

    return withSidecarMutateFallback(
      "/workspace/interaction",
      "POST",
      { agentId, ...input },
      () => {
        const db          = getDb();
        const interaction = contactsRepo.logInteraction(db, agentId, input);
        return { ok: true, interaction };
      },
    );
  } catch (err) {
    return handleApiError(err, "workspace/interaction POST");
  }
}
