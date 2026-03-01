/**
 * POST /api/generate/docx
 *
 * Converts Markdown (or HTML) to a Word-compatible HTML document (.doc format).
 *
 * This endpoint returns a "Word HTML" document — an HTML file with Microsoft
 * Office XML namespace declarations that Word, LibreOffice, and Google Drive
 * all recognize and open natively. The response is served with:
 *   Content-Type: application/msword
 *   Content-Disposition: attachment; filename="<title>.doc"
 *
 * When uploaded to Google Drive, it auto-converts to a Google Doc. The user
 * can then File > Download > Microsoft Word (.docx) to get a proper DOCX.
 *
 * This approach satisfies the "no new npm deps" constraint — the docx npm
 * package is not used. Word HTML is a well-established interchange format
 * with near-universal compatibility.
 *
 * Request body (JSON):
 * ```json
 * {
 *   "markdown":    "# Title\n\nBody...",   // provide markdown OR html
 *   "html":        "<h1>Title</h1>",        // raw HTML fragment
 *   "title":       "Project Proposal",      // document title
 *   "author":      "Alex",                  // shown in metadata
 *   "date":        "2026-03-01",            // ISO date string
 *   "paperSize":   "letter",                // "letter" | "a4"
 *   "accentColor": "#1a2744",               // heading color
 *   "showTitle":   true                     // render title heading block
 * }
 * ```
 *
 * Response: `application/msword` — Word HTML document as UTF-8.
 *
 * On success, callers should:
 *   1. Upload the buffer to Google Drive via `documentService.uploadToDrive()`.
 *      Drive converts it to a Google Doc. User downloads as DOCX from Drive.
 *   2. Return the Drive share link to the end-user.
 *
 * Error responses:
 *   400 — missing/invalid body
 *   429 — concurrency limit reached (pool timeout)
 *   500 — internal error
 */

import { NextResponse } from "next/server";
import { withSlot } from "@/lib/browser/pool";
import { toWordHtml, type WordDocumentOptions } from "@/lib/document/toWordHtml";
import { handleApiError } from "@/lib/api/helpers";

export const runtime = "nodejs";

// Maximum input size: 500 KB
const MAX_INPUT_BYTES = 500 * 1024;

interface GenerateDocxBody {
  markdown?: unknown;
  html?: unknown;
  title?: unknown;
  author?: unknown;
  date?: unknown;
  paperSize?: unknown;
  accentColor?: unknown;
  showTitle?: unknown;
}

export async function POST(request: Request): Promise<NextResponse> {
  // ── Parse body ────────────────────────────────────────────────────────────
  let body: GenerateDocxBody;
  try {
    body = (await request.json()) as GenerateDocxBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // ── Validate input ────────────────────────────────────────────────────────
  const markdown = typeof body.markdown === "string" ? body.markdown : undefined;
  const html = typeof body.html === "string" ? body.html : undefined;

  if (!markdown && !html) {
    return NextResponse.json(
      { error: "Provide either 'markdown' or 'html' in the request body." },
      { status: 400 },
    );
  }

  const content = markdown ?? html ?? "";
  if (Buffer.byteLength(content, "utf-8") > MAX_INPUT_BYTES) {
    return NextResponse.json(
      { error: `Input exceeds maximum size of ${MAX_INPUT_BYTES / 1024} KB.` },
      { status: 400 },
    );
  }

  const title = typeof body.title === "string" ? body.title.trim() : "Document";
  const author = typeof body.author === "string" ? body.author.trim() : undefined;
  const date = typeof body.date === "string" ? body.date : undefined;
  const paperSize =
    body.paperSize === "a4" || body.paperSize === "letter" ? body.paperSize : "letter";
  const accentColor =
    typeof body.accentColor === "string" && /^#[0-9a-fA-F]{3,6}$/.test(body.accentColor)
      ? body.accentColor
      : undefined;
  const showTitle = body.showTitle !== false; // default true

  const opts: WordDocumentOptions = {
    title,
    author,
    date,
    paperSize,
    accentColor,
    showTitle,
    inputType: markdown ? "markdown" : "html",
  };

  // ── Render inside concurrency pool ────────────────────────────────────────
  let wordDocument: string;
  try {
    wordDocument = await withSlot(() => Promise.resolve(toWordHtml(content, opts)));
  } catch (err) {
    if (err instanceof Error && err.message.includes("timed out")) {
      return NextResponse.json(
        {
          error: "Document generation capacity reached. Please retry shortly.",
          code: "POOL_TIMEOUT",
        },
        { status: 429 },
      );
    }
    return handleApiError(err, "generate/docx POST", "Failed to generate Word document.");
  }

  // ── Return Word HTML document ─────────────────────────────────────────────
  const encoded = Buffer.from(wordDocument, "utf-8");

  return new NextResponse(encoded, {
    status: 200,
    headers: {
      "Content-Type": "application/msword",
      "Content-Length": String(encoded.byteLength),
      "Content-Disposition": `attachment; filename="${encodeFilename(title)}.doc"`,
      "Cache-Control": "no-store",
    },
  });
}

function encodeFilename(title: string): string {
  return (
    title
      .replace(/[^a-zA-Z0-9\s\-_]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 64) || "document"
  );
}
