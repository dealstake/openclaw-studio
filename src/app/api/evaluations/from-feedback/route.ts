/**
 * POST /api/evaluations/from-feedback — convert a feedback annotation into an eval test case.
 *
 * Creates or appends to the "Feedback-Derived" test set.
 * Flagged / thumbs-down annotations become test cases with the original
 * user message as input and the annotation comment as expected criteria.
 */

import { NextResponse, type NextRequest } from "next/server";

import { handleApiError } from "@/lib/api/helpers";
import {
  createTestSet,
  generateId,
  listTestSets,
  updateTestSet,
} from "@/features/evaluations/lib/storage";
import type { TestCase } from "@/features/evaluations/lib/types";

export const runtime = "nodejs";

const FEEDBACK_TEST_SET_NAME = "Feedback-Derived";

type FromFeedbackPayload = {
  /** The user message that preceded the annotated response. */
  userMessage: string;
  /** The agent's response that was flagged. */
  agentResponse?: string;
  /** Annotation rating (thumbs_down or flag). */
  rating: string;
  /** Optional comment from the annotation — becomes an expected criterion. */
  comment?: string;
  /** Session key for traceability. */
  sessionKey?: string;
  /** Message ID for traceability. */
  messageId?: string;
};

function isValid(body: unknown): body is FromFeedbackPayload {
  if (!body || typeof body !== "object") return false;
  const b = body as FromFeedbackPayload;
  return typeof b.userMessage === "string" && b.userMessage.trim().length > 0;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as unknown;
    if (!isValid(body)) {
      return NextResponse.json(
        { error: "userMessage is required." },
        { status: 400 },
      );
    }

    const { userMessage, agentResponse, rating, comment, sessionKey, messageId } = body;

    // Build criteria from annotation context
    const criteria: string[] = [];
    if (comment?.trim()) {
      criteria.push(comment.trim());
    }
    if (rating === "flag") {
      criteria.push("Response was flagged for review — verify correctness");
    } else if (rating === "thumbs_down") {
      criteria.push("Response received negative feedback — improve quality");
    }

    // Build tags for filtering
    const tags: string[] = [`source:feedback`, `rating:${rating}`];
    if (sessionKey) tags.push(`session:${sessionKey}`);

    const testCase: TestCase = {
      id: generateId(),
      testSetId: "", // corrected below
      userMessage: userMessage.trim(),
      systemPrompt: agentResponse
        ? `Original (flagged) response for reference:\n${agentResponse}`
        : undefined,
      expectedCriteria: criteria,
      tags,
    };

    // Find or create the feedback-derived test set
    const allSets = listTestSets();
    const existing = allSets.find((s) => s.name === FEEDBACK_TEST_SET_NAME);

    if (existing) {
      // Check for duplicate (same userMessage + messageId)
      const isDupe = existing.cases.some(
        (c) =>
          c.userMessage === testCase.userMessage &&
          messageId &&
          c.tags.includes(`msg:${messageId}`),
      );
      if (isDupe) {
        return NextResponse.json(
          { error: "Test case already exists for this annotation." },
          { status: 409 },
        );
      }

      testCase.testSetId = existing.id;
      if (messageId) testCase.tags.push(`msg:${messageId}`);
      const updatedCases = [...existing.cases, testCase];
      const updated = updateTestSet(existing.id, { cases: updatedCases });
      return NextResponse.json({ testSet: updated, testCase }, { status: 200 });
    }

    // Create new test set
    testCase.testSetId = "pending";
    if (messageId) testCase.tags.push(`msg:${messageId}`);
    const testSet = createTestSet({
      name: FEEDBACK_TEST_SET_NAME,
      description:
        "Auto-generated test cases from flagged and negatively-rated feedback annotations.",
      cases: [testCase],
    });
    // Get the case with corrected testSetId
    const createdCase = testSet.cases[0];
    return NextResponse.json({ testSet, testCase: createdCase }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "evaluations/from-feedback POST");
  }
}
