/**
 * POST /api/artifacts/share
 *
 * Makes a Drive file accessible to "anyone with the link" (reader role)
 * and returns the shareable webViewLink.
 *
 * Body: { fileId: string }
 * Returns: { shareLink: string }
 */
import { NextResponse } from "next/server";
import { getShareLink } from "@/lib/google/drive";
import { handleApiError } from "@/lib/api/helpers";

export const runtime = "nodejs";

interface ShareRequest {
  fileId: string;
}

function isShareRequest(body: unknown): body is ShareRequest {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as Record<string, unknown>).fileId === "string" &&
    (body as Record<string, unknown>).fileId !== ""
  );
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isShareRequest(body)) {
    return NextResponse.json(
      { error: "Missing required field: fileId (non-empty string)." },
      { status: 400 },
    );
  }

  try {
    const shareLink = await getShareLink(body.fileId);
    return NextResponse.json({ shareLink });
  } catch (err) {
    return handleApiError(err, "artifacts/share POST", "Failed to generate share link.");
  }
}
