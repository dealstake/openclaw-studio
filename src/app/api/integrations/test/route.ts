/**
 * Connection test API route for credential templates.
 *
 * POST /api/integrations/test
 * Body: { templateId: string; credentials: Record<string, string> }
 * Returns: { success: boolean; message: string }
 *
 * Delegates to shared connectionTestHandlers — same handlers used by
 * preflightService for server-side direct invocation.
 */

import { NextResponse } from "next/server";
import { CONNECTION_TEST_HANDLERS } from "@/features/credentials/lib/connectionTestHandlers";

interface TestRequest {
  templateId: string;
  credentials: Record<string, string>;
}

interface TestResponse {
  success: boolean;
  message: string;
}

export async function POST(
  request: Request,
): Promise<NextResponse<TestResponse>> {
  try {
    const body = (await request.json()) as TestRequest;
    const handler = CONNECTION_TEST_HANDLERS[body.templateId];

    if (!handler) {
      return NextResponse.json(
        { success: false, message: "Unknown integration" },
        { status: 400 },
      );
    }

    const result = await handler(body.credentials);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { success: false, message: "Test failed unexpectedly" },
      { status: 500 },
    );
  }
}
