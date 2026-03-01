/**
 * GET    /api/evaluations/[id]   — get a test set by id
 * PATCH  /api/evaluations/[id]   — update a test set
 * DELETE /api/evaluations/[id]   — delete a test set
 */

import { NextResponse, type NextRequest } from "next/server";

import { handleApiError } from "@/lib/api/helpers";
import {
  deleteTestSet,
  getTestSetById,
  listExperimentsByTestSet,
  updateTestSet,
} from "@/features/evaluations/lib/storage";
import type { UpdateTestSetPayload } from "@/features/evaluations/lib/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

// ─── GET /api/evaluations/[id] ────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const testSet = getTestSetById(id);
    if (!testSet) {
      return NextResponse.json(
        { error: "Test set not found." },
        { status: 404 }
      );
    }
    const experiments = listExperimentsByTestSet(id);
    return NextResponse.json({ testSet, experiments });
  } catch (err) {
    return handleApiError(err, "evaluations/[id] GET");
  }
}

// ─── PATCH /api/evaluations/[id] ─────────────────────────────────────────────

function isUpdatePayload(value: unknown): value is UpdateTestSetPayload {
  return Boolean(value) && typeof value === "object";
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = (await request.json()) as unknown;
    if (!isUpdatePayload(body)) {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const patch: UpdateTestSetPayload = {};
    if (typeof body.name === "string") patch.name = body.name.trim();
    if (typeof body.description === "string") patch.description = body.description.trim();
    if (Array.isArray(body.cases)) patch.cases = body.cases;

    const updated = updateTestSet(id, patch);
    if (!updated) {
      return NextResponse.json(
        { error: "Test set not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ testSet: updated });
  } catch (err) {
    return handleApiError(err, "evaluations/[id] PATCH");
  }
}

// ─── DELETE /api/evaluations/[id] ────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const deleted = deleteTestSet(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Test set not found." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, "evaluations/[id] DELETE");
  }
}
