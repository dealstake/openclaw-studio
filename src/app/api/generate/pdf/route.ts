/**
 * POST /api/generate/pdf
 *
 * Converts Markdown (or HTML) to a print-optimized HTML document.
 *
 * This endpoint returns an HTML document styled for printing. When the
 * generated file is uploaded to Google Drive, Drive auto-converts it to a
 * Google Doc — the user can then File > Print > Save as PDF, or the Studio
 * UI can open the Google Doc's export URL for a server-side PDF. This avoids
 * the DoS risk of running headless Chromium per-request (P0 audit finding).
 *
 * Concurrency is bounded by the browser pool (default: 3 concurrent renders)
 * to prevent CPU exhaustion from heavily-nested Markdown or large tables.
 *
 * Request body (JSON):
 * ```json
 * {
 *   "markdown":    "# Title\n\nBody...",   // provide markdown OR html
 *   "html":        "<h1>Title</h1>",        // raw HTML fragment (unsafe — sanitize before sending)
 *   "title":       "Q1 Planning Brief",     // document title
 *   "author":      "Alex",                  // shown in metadata + footer
 *   "date":        "2026-03-01",            // ISO date string
 *   "paperSize":   "letter",                // "letter" | "a4"
 *   "accentColor": "#1a2744",               // heading / border color
 *   "showHeader":  true,                    // render title header block
 *   "showFooter":  false                    // render author / page footer
 * }
 * ```
 *
 * Response: `text/html; charset=utf-8` — full HTML document as UTF-8 text.
 *
 * On success, callers should:
 *   1. Upload the HTML buffer to Google Drive via `POST /api/generate/upload`
 *      (which calls `uploadToDrive()` from documentService) — Drive converts
 *      to a Google Doc automatically.
 *   2. Return the Drive share link to the end-user.
 *
 * Error responses:
 *   400 — missing/invalid body
 *   429 — concurrency limit reached (pool timeout)
 *   500 — internal error
 */

import { NextResponse } from "next/server";
import { withSlot } from "@/lib/browser/pool";
import { toPrintHtml, type PrintDocumentOptions } from "@/lib/document/toPrintHtml";
import { handleApiError } from "@/lib/api/helpers";

export const runtime = "nodejs";

// Maximum input size: 500 KB of Markdown / HTML
const MAX_INPUT_BYTES = 500 * 1024;

interface GeneratePdfBody {
  markdown?: unknown;
  html?: unknown;
  title?: unknown;
  author?: unknown;
  date?: unknown;
  paperSize?: unknown;
  accentColor?: unknown;
  showHeader?: unknown;
  showFooter?: unknown;
}

export async function POST(request: Request): Promise<NextResponse> {
  // ── Parse body ────────────────────────────────────────────────────────────
  let body: GeneratePdfBody;
  try {
    body = (await request.json()) as GeneratePdfBody;
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
  const showHeader = body.showHeader !== false; // default true
  const showFooter = body.showFooter === true;  // default false

  const opts: PrintDocumentOptions = {
    title,
    author,
    date,
    paperSize,
    accentColor,
    showHeader,
    showFooter,
    inputType: markdown ? "markdown" : "html",
  };

  // ── Render inside concurrency pool ────────────────────────────────────────
  let htmlDocument: string;
  try {
    htmlDocument = await withSlot(() => Promise.resolve(toPrintHtml(content, opts)));
  } catch (err) {
    // Pool timeout → 429
    if (err instanceof Error && err.message.includes("timed out")) {
      return NextResponse.json(
        {
          error: "Document generation capacity reached. Please retry shortly.",
          code: "POOL_TIMEOUT",
        },
        { status: 429 },
      );
    }
    return handleApiError(err, "generate/pdf POST", "Failed to generate PDF document.");
  }

  // ── Return HTML document ──────────────────────────────────────────────────
  const encoded = Buffer.from(htmlDocument, "utf-8");

  return new NextResponse(encoded, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Length": String(encoded.byteLength),
      // Suggest filename for when the caller downloads directly
      "Content-Disposition": `attachment; filename="${encodeFilename(title)}.html"`,
      // No caching — documents are one-shot renders
      "Cache-Control": "no-store",
    },
  });
}

function encodeFilename(title: string): string {
  // Strip characters unsafe in Content-Disposition filenames
  return title.replace(/[^a-zA-Z0-9\s\-_]/g, "").trim().replace(/\s+/g, "-").slice(0, 64) ||
    "document";
}
