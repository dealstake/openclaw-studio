/**
 * GET  /api/evaluations   — list all test sets
 * POST /api/evaluations   — create a new test set
 */

import { NextResponse, type NextRequest } from "next/server";

import { handleApiError } from "@/lib/api/helpers";
import {
  createTestSet,
  generateId,
  listTestSets,
} from "@/features/evaluations/lib/storage";
import type { CreateTestSetPayload, TestCase } from "@/features/evaluations/lib/types";

export const runtime = "nodejs";

// ─── GET /api/evaluations ─────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    const testSets = listTestSets();
    return NextResponse.json({ testSets });
  } catch (err) {
    return handleApiError(err, "evaluations GET");
  }
}

// ─── POST /api/evaluations ────────────────────────────────────────────────────

function isCreatePayload(value: unknown): value is CreateTestSetPayload {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    "name" in (value as object) &&
    typeof (value as CreateTestSetPayload).name === "string"
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as unknown;
    if (!isCreatePayload(body)) {
      return NextResponse.json({ error: "name is required." }, { status: 400 });
    }

    const { name, description = "", cases = [] } = body;
    if (!name.trim()) {
      return NextResponse.json(
        { error: "name must not be empty." },
        { status: 400 }
      );
    }

    // Assign IDs to cases; testSetId will be corrected by createTestSet
    const resolvedCases: TestCase[] = cases.map((c) => ({
      id: generateId(),
      testSetId: "", // corrected by createTestSet
      userMessage: c.userMessage ?? "",
      systemPrompt: c.systemPrompt,
      expectedCriteria: c.expectedCriteria ?? [],
      tags: c.tags ?? [],
    }));

    const testSet = createTestSet({
      name: name.trim(),
      description: description.trim(),
      cases: resolvedCases,
    });

    return NextResponse.json({ testSet }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "evaluations POST");
  }
}
