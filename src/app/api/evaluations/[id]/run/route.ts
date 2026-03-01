/**
 * POST /api/evaluations/[id]/run — create and queue an experiment run.
 *
 * Phase 1: Creates the Experiment record with status "pending".
 * Actual execution (dispatching to agents, capturing traces) is implemented
 * in Phase 3 once Parallel Agent Dispatch is available.
 */

import { NextResponse, type NextRequest } from "next/server";

import { handleApiError } from "@/lib/api/helpers";
import {
  createExperiment,
  getTestSetById,
} from "@/features/evaluations/lib/storage";
import type { RunExperimentPayload } from "@/features/evaluations/lib/types";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function isRunPayload(value: unknown): value is RunExperimentPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<RunExperimentPayload>;
  return (
    typeof v.name === "string" &&
    Array.isArray(v.variants) &&
    v.variants.length > 0 &&
    v.variants.length <= 3
  );
}

// ─── POST /api/evaluations/[id]/run ──────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const { id: testSetId } = await params;

    const testSet = getTestSetById(testSetId);
    if (!testSet) {
      return NextResponse.json(
        { error: "Test set not found." },
        { status: 404 }
      );
    }
    if (testSet.cases.length === 0) {
      return NextResponse.json(
        { error: "Test set has no cases. Add at least one case before running." },
        { status: 422 }
      );
    }

    const body = (await request.json()) as unknown;
    if (!isRunPayload(body)) {
      return NextResponse.json(
        {
          error:
            "name and variants (1–3 items) are required. Each variant must include agentId.",
        },
        { status: 400 }
      );
    }

    // Validate each variant has an agentId
    for (const variant of body.variants) {
      if (!variant.agentId?.trim()) {
        return NextResponse.json(
          { error: "Each variant must have a non-empty agentId." },
          { status: 400 }
        );
      }
    }

    const experiment = createExperiment({
      name: body.name.trim(),
      testSetId,
      variants: body.variants.map((v) => ({
        agentId: v.agentId.trim(),
        modelOverride: v.modelOverride?.trim(),
        systemPromptOverride: v.systemPromptOverride?.trim(),
      })),
      status: "pending",
    });

    return NextResponse.json(
      {
        experiment,
        message:
          "Experiment created with status 'pending'. Execution engine (Phase 3) will dispatch runs when available.",
      },
      { status: 201 }
    );
  } catch (err) {
    return handleApiError(err, "evaluations/[id]/run POST");
  }
}
