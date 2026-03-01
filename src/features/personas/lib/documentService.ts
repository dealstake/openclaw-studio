/**
 * Document Service — orchestrates template rendering, format conversion,
 * and Google Drive upload for persona document generation.
 *
 * This module is the single entry point for document generation workflows.
 * It wires together:
 *   - Phase 1: Handlebars template engine (documentTemplates.ts)
 *   - Phase 2: Format conversion (toPrintHtml, toWordHtml)
 *   - Drive upload (src/lib/google/drive.ts)
 *
 * Design notes:
 *  - All functions are server-side only (no React imports).
 *  - Drive upload is MANDATORY for all generated documents: the ArtifactsPanel
 *    only surfaces files that live in Google Drive (P0 audit finding).
 *  - uploadToDrive() can be called independently for raw buffers (e.g. when a
 *    persona generates a document via LLM and needs to publish it).
 *
 * @module
 *
 * @example
 *   import { generateDocument } from "@/features/personas/lib/documentService";
 *
 *   const result = await generateDocument({
 *     personaTemplateKey: "executive-assistant",
 *     templateFilename:   "meeting-brief.md.hbs",
 *     data: { meeting_title: "Q1 Planning", date: new Date(), attendees: ["Alice", "Bob"] },
 *     format: "pdf",
 *     title: "Q1 Planning Brief",
 *     author: "Alex",
 *   });
 *
 *   console.log(result.driveFile.webViewLink); // Google Doc / Drive URL
 */

import { renderDocTemplate } from "./documentTemplates";
import { toPrintHtml } from "@/lib/document/toPrintHtml";
import { toWordHtml } from "@/lib/document/toWordHtml";
import { uploadFile, type DriveFile } from "@/lib/google/drive";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Output format for generated documents. */
export type DocumentFormat = "md" | "pdf" | "docx";

export interface GenerateDocumentOptions {
  /**
   * The persona template key used to look up the document template.
   * E.g. "executive-assistant", "cold-caller".
   */
  personaTemplateKey: string;

  /**
   * The filename of the document template within the persona's template set.
   * E.g. "meeting-brief.md.hbs".
   */
  templateFilename: string;

  /**
   * Data object passed to the Handlebars template for variable substitution.
   * Must match the variables defined in the template's `variables` field.
   */
  data: Record<string, unknown>;

  /**
   * Output format.
   *  - "md"   — raw Markdown (uploaded as .md to Drive)
   *  - "pdf"  — print-optimized HTML (.html uploaded to Drive; Drive renders as Google Doc)
   *  - "docx" — Word HTML (.doc uploaded to Drive; opens in Word / Google Docs)
   */
  format: DocumentFormat;

  /** Document title for the generated file. Falls back to the template filename. */
  title?: string;

  /** Author name shown in document metadata and footers. */
  author?: string;

  /** ISO date string. Defaults to the current date. */
  date?: string;

  /** Paper size. Default: "letter". */
  paperSize?: "letter" | "a4";

  /** Accent color for headings (CSS hex). Default: #1a2744. */
  accentColor?: string;

  /** Google Drive folder ID to upload into. Omit to upload to root. */
  driveFolderId?: string;

  /** Email addresses to share the uploaded file with (reader access). */
  shareWith?: string[];
}

export interface GenerateDocumentResult {
  /** The rendered content as a Buffer (HTML or Markdown). */
  buffer: Buffer;
  /** MIME type of the generated file. */
  mimeType: string;
  /** Suggested filename (with extension). */
  filename: string;
  /** The DriveFile metadata returned after upload. */
  driveFile: DriveFile;
}

export interface UploadToDriveOptions {
  /** Display name in Google Drive. */
  filename: string;
  /** MIME type of the content. */
  mimeType: string;
  /** Google Drive folder ID. Omit to use root. */
  folderId?: string;
}

export interface UploadToDriveResult {
  driveFile: DriveFile;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive MIME type and file extension for a given output format.
 */
function getFormatMeta(format: DocumentFormat): { mimeType: string; extension: string } {
  switch (format) {
    case "md":
      return { mimeType: "text/plain", extension: "md" };
    case "pdf":
      // Upload as text/html — Google Drive auto-converts to a Google Doc,
      // which the user can File > Print > Save as PDF.
      return { mimeType: "text/html", extension: "html" };
    case "docx":
      // Word HTML format — recognized by Word, LibreOffice, and Google Drive.
      return { mimeType: "application/msword", extension: "doc" };
  }
}

/**
 * Sanitize a string for use as a Drive filename.
 * Strips characters that are problematic in most file systems.
 */
function sanitizeFilename(name: string, extension: string): string {
  const base = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 128);
  return base ? `${base}.${extension}` : `document.${extension}`;
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

/**
 * Generate a document from a persona's Handlebars template and upload it to
 * Google Drive. Returns the Drive file metadata and a pre-signed share link.
 *
 * This function performs:
 *   1. Template lookup via the persona template registry
 *   2. Handlebars rendering (variable substitution, built-in helpers)
 *   3. Format conversion (Markdown → print HTML | Word HTML | raw Markdown)
 *   4. Google Drive upload
 *
 * @throws Error if the template is not found or Drive upload fails.
 */
export async function generateDocument(
  opts: GenerateDocumentOptions,
): Promise<GenerateDocumentResult> {
  const {
    personaTemplateKey,
    templateFilename,
    data,
    format,
    title,
    author,
    date,
    paperSize = "letter",
    accentColor = "#1a2744",
    driveFolderId,
  } = opts;

  // ── 1. Render the Handlebars template to Markdown ──────────────────────
  const rendered = renderDocTemplate(personaTemplateKey, templateFilename, data);
  if (rendered === null) {
    throw new Error(
      `Document template not found: persona="${personaTemplateKey}", file="${templateFilename}". ` +
        `Ensure the template is registered in the persona's documentTemplates array.`,
    );
  }

  const docTitle = title ?? templateFilename.replace(/\.md\.hbs$/, "").replace(/-/g, " ");

  // ── 2. Convert to the requested output format ──────────────────────────
  let content: string;
  const { mimeType, extension } = getFormatMeta(format);

  switch (format) {
    case "md":
      content = rendered;
      break;

    case "pdf":
      content = toPrintHtml(rendered, {
        title: docTitle,
        author,
        date,
        paperSize,
        accentColor,
        showHeader: true,
        showFooter: Boolean(author),
        inputType: "markdown",
      });
      break;

    case "docx":
      content = toWordHtml(rendered, {
        title: docTitle,
        author,
        date,
        paperSize,
        accentColor,
        showTitle: true,
        inputType: "markdown",
      });
      break;

    default: {
      // TypeScript exhaustiveness check
      const _exhaustive: never = format;
      throw new Error(`Unknown format: ${String(_exhaustive)}`);
    }
  }

  const buffer = Buffer.from(content, "utf-8");
  const filename = sanitizeFilename(docTitle, extension);

  // ── 3. Upload to Google Drive ──────────────────────────────────────────
  const driveFile = await uploadFile(filename, buffer, mimeType, driveFolderId);

  return { buffer, mimeType, filename, driveFile };
}

/**
 * Upload arbitrary content to Google Drive.
 *
 * Use this when:
 *  - A persona has generated content via LLM (not via a Handlebars template)
 *  - You have a pre-rendered buffer from `toPrintHtml` / `toWordHtml`
 *  - You want to upload a raw Markdown file
 *
 * The ArtifactsPanel ONLY shows files from Google Drive, so ALL persona-generated
 * documents MUST be uploaded here before being returned to the user (P0 audit finding).
 *
 * @example
 *   const result = await uploadToDrive(markdownBuffer, {
 *     filename: "report.md",
 *     mimeType: "text/plain",
 *     folderId: process.env.DRIVE_PERSONA_FOLDER_ID,
 *   });
 *   return result.driveFile.webViewLink; // share this URL
 */
export async function uploadToDrive(
  content: Buffer | string,
  opts: UploadToDriveOptions,
): Promise<UploadToDriveResult> {
  const { filename, mimeType, folderId } = opts;

  const buffer = typeof content === "string" ? Buffer.from(content, "utf-8") : content;

  const driveFile = await uploadFile(filename, buffer, mimeType, folderId);

  return { driveFile };
}

/**
 * Convenience: render Markdown content to print HTML and upload to Drive.
 *
 * Combines `toPrintHtml` + `uploadToDrive` in a single call for use cases
 * where the rendered Markdown is available but not yet in Drive.
 *
 * @returns DriveFile metadata (includes webViewLink for sharing)
 */
export async function uploadMarkdownAsPdf(
  markdown: string,
  opts: {
    title: string;
    author?: string;
    date?: string;
    accentColor?: string;
    driveFolderId?: string;
  },
): Promise<DriveFile> {
  const htmlContent = toPrintHtml(markdown, {
    title: opts.title,
    author: opts.author,
    date: opts.date,
    accentColor: opts.accentColor,
    showHeader: true,
    showFooter: Boolean(opts.author),
    inputType: "markdown",
  });

  const filename = sanitizeFilename(opts.title, "html");
  const { driveFile } = await uploadToDrive(htmlContent, {
    filename,
    mimeType: "text/html",
    folderId: opts.driveFolderId,
  });

  return driveFile;
}

/**
 * Convenience: render Markdown content to Word HTML and upload to Drive.
 *
 * @returns DriveFile metadata (includes webViewLink for sharing)
 */
export async function uploadMarkdownAsDocx(
  markdown: string,
  opts: {
    title: string;
    author?: string;
    date?: string;
    accentColor?: string;
    driveFolderId?: string;
  },
): Promise<DriveFile> {
  const wordHtml = toWordHtml(markdown, {
    title: opts.title,
    author: opts.author,
    date: opts.date,
    accentColor: opts.accentColor,
    showTitle: true,
    inputType: "markdown",
  });

  const filename = sanitizeFilename(opts.title, "doc");
  const { driveFile } = await uploadToDrive(wordHtml, {
    filename,
    mimeType: "application/msword",
    folderId: opts.driveFolderId,
  });

  return driveFile;
}
