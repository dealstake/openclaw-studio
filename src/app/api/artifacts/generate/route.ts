/**
 * POST /api/artifacts/generate
 *
 * Generate a document from a persona Handlebars template, convert to the
 * requested format, upload to Google Drive, and return the DriveFile metadata.
 *
 * Body: GenerateArtifactRequest
 * Returns: { file: DriveFile }
 *
 * Rate-limiting: inherits from the browser pool (max 3 concurrent renders).
 * Returns 429 if the pool queue is exhausted.
 */
import { NextResponse } from "next/server";
import { generateDocument } from "@/features/personas/lib/documentService";
import { handleApiError } from "@/lib/api/helpers";
import type { DocumentFormat } from "@/features/personas/lib/documentService";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 200 * 1024; // 200 KB

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GenerateArtifactRequest {
  /** Persona template key, e.g. "executive-assistant" */
  personaTemplateKey: string;
  /** Template filename, e.g. "meeting-brief.md.hbs" */
  templateFilename: string;
  /** Variable substitution data for the Handlebars template */
  data: Record<string, unknown>;
  /** Output format. Defaults to "pdf". */
  format?: DocumentFormat;
  /** Document title. Falls back to templateFilename. */
  title?: string;
  /** Author name used in document metadata. */
  author?: string;
  /** ISO date string. Defaults to today. */
  date?: string;
  /** Google Drive folder ID. Omit to upload to root. */
  driveFolderId?: string;
}

// ── Validators ─────────────────────────────────────────────────────────────────

const VALID_FORMATS: DocumentFormat[] = ["md", "pdf", "docx"];

function isValidFormat(value: unknown): value is DocumentFormat {
  return typeof value === "string" && (VALID_FORMATS as string[]).includes(value);
}

function isGenerateRequest(body: unknown): body is GenerateArtifactRequest {
  if (typeof body !== "object" || body === null) return false;
  const obj = body as Record<string, unknown>;
  return (
    typeof obj.personaTemplateKey === "string" &&
    obj.personaTemplateKey.trim() !== "" &&
    typeof obj.templateFilename === "string" &&
    obj.templateFilename.trim() !== "" &&
    typeof obj.data === "object" &&
    obj.data !== null
  );
}

// ── Route Handler ──────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  // Enforce request size limit
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: `Request body too large. Maximum is ${MAX_BODY_BYTES / 1024}KB.` },
      { status: 413 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isGenerateRequest(body)) {
    return NextResponse.json(
      {
        error:
          "Missing required fields: personaTemplateKey (string), templateFilename (string), data (object).",
      },
      { status: 400 },
    );
  }

  // Validate optional format
  if (body.format !== undefined && !isValidFormat(body.format)) {
    return NextResponse.json(
      { error: `Invalid format "${String(body.format)}". Must be one of: ${VALID_FORMATS.join(", ")}.` },
      { status: 400 },
    );
  }

  try {
    const result = await generateDocument({
      personaTemplateKey: body.personaTemplateKey.trim(),
      templateFilename: body.templateFilename.trim(),
      data: body.data,
      format: body.format ?? "pdf",
      title: typeof body.title === "string" ? body.title.trim() || undefined : undefined,
      author: typeof body.author === "string" ? body.author.trim() || undefined : undefined,
      date: typeof body.date === "string" ? body.date.trim() || undefined : undefined,
      driveFolderId:
        typeof body.driveFolderId === "string"
          ? body.driveFolderId.trim() || undefined
          : undefined,
    });

    return NextResponse.json({ file: result.driveFile }, { status: 201 });
  } catch (err) {
    return handleApiError(err, "artifacts/generate POST", "Failed to generate document.");
  }
}
