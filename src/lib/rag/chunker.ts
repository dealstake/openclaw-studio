/**
 * RAG Chunking Utilities
 *
 * Splits documents into retrievable chunks suitable for FTS5 indexing.
 * Chunk size is expressed in approximate tokens (4 chars ≈ 1 token).
 *
 * Shared utility — used by the knowledge ingestion pipeline and any future
 * RAG feature that needs to index and retrieve document content.
 */

// ─── Constants ────────────────────────────────────────────────────────────────

/** Approximate characters per token (GPT-4 / Llama style, English text). */
const CHARS_PER_TOKEN = 4;

/** Default maximum tokens per chunk. */
export const DEFAULT_MAX_TOKENS = 500;

/** Default overlap in tokens between adjacent plain-text chunks. */
export const DEFAULT_OVERLAP_TOKENS = 50;

/** Maximum buffer size for binary extraction (10 MB). */
const MAX_BINARY_BYTES = 10 * 1024 * 1024;

// ─── Token estimation ─────────────────────────────────────────────────────────

/**
 * Estimate the token count for a string.
 * Uses the 4-chars-per-token heuristic — good enough for English text
 * and fast enough to call on every chunk.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

// ─── Markdown Chunker ─────────────────────────────────────────────────────────

/**
 * Split a Markdown string into semantically meaningful chunks.
 *
 * Strategy:
 *  1. Strip YAML frontmatter (--- … ---).
 *  2. Split on ATX headings (# / ## / ### …) while preserving code blocks.
 *  3. Each heading + its body forms a section.
 *  4. If a section exceeds `maxTokens`, recursively split on double-newline
 *     paragraphs.
 *  5. If a paragraph still exceeds `maxTokens`, fall through to
 *     `chunkPlainText` for character-level splitting.
 *
 * Empty chunks and whitespace-only chunks are discarded.
 *
 * @param content   Raw markdown string.
 * @param maxTokens Maximum tokens per chunk (default 500).
 * @returns         Array of chunk strings, each ≤ maxTokens.
 */
export function chunkMarkdown(
  content: string,
  maxTokens: number = DEFAULT_MAX_TOKENS,
): string[] {
  // 1. Strip YAML frontmatter
  const stripped = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, "");

  // 2. Split on headings while respecting fenced code blocks
  const sections = splitMarkdownSections(stripped);

  // 3. Expand over-long sections
  const chunks: string[] = [];
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    if (estimateTokens(trimmed) <= maxTokens) {
      chunks.push(trimmed);
    } else {
      // Split on double-newline paragraphs within the section
      chunks.push(...splitSectionByParagraphs(trimmed, maxTokens));
    }
  }

  return chunks.filter((c) => c.trim().length > 0);
}

/**
 * Split markdown into sections on ATX headings (# / ## / ###).
 * Code blocks are tracked so that headings inside ``` blocks are ignored.
 */
function splitMarkdownSections(text: string): string[] {
  const lines = text.split("\n");
  const sections: string[] = [];
  let current: string[] = [];
  let inFence = false;
  let fenceChar = "";

  for (const line of lines) {
    // Track fenced code blocks (``` or ~~~)
    const fenceMatch = /^(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      if (!inFence) {
        inFence = true;
        fenceChar = fenceMatch[1][0];
      } else if (line.startsWith(fenceChar.repeat(3))) {
        inFence = false;
        fenceChar = "";
      }
    }

    // Detect ATX headings only outside code blocks
    if (!inFence && /^#{1,6}\s/.test(line) && current.length > 0) {
      sections.push(current.join("\n"));
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    sections.push(current.join("\n"));
  }

  return sections;
}

/**
 * Split an over-long markdown section into paragraph-sized pieces.
 * Falls back to `chunkPlainText` for paragraphs that are still too large.
 */
function splitSectionByParagraphs(section: string, maxTokens: number): string[] {
  // Separate the heading line (if any) from the body
  const lines = section.split("\n");
  let heading = "";
  let bodyStart = 0;

  if (/^#{1,6}\s/.test(lines[0])) {
    heading = lines[0];
    bodyStart = 1;
  }

  // Split body on blank lines
  const body = lines.slice(bodyStart).join("\n");
  const paragraphs = body.split(/\n{2,}/);

  const chunks: string[] = [];
  let accumulated: string[] = heading ? [heading] : [];
  let accTokens = estimateTokens(heading);

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    const paraTokens = estimateTokens(trimmed);

    if (paraTokens > maxTokens) {
      // Flush accumulated buffer first
      if (accumulated.length > 0) {
        chunks.push(accumulated.join("\n\n").trim());
        accumulated = [];
        accTokens = 0;
      }
      // Sub-chunk the oversized paragraph
      chunks.push(...chunkPlainText(trimmed, maxTokens));
      continue;
    }

    if (accTokens + paraTokens > maxTokens && accumulated.length > 0) {
      chunks.push(accumulated.join("\n\n").trim());
      // Re-seed next chunk with the heading so context is preserved
      accumulated = heading ? [heading] : [];
      accTokens = estimateTokens(heading);
    }

    accumulated.push(trimmed);
    accTokens += paraTokens;
  }

  if (accumulated.length > 0) {
    chunks.push(accumulated.join("\n\n").trim());
  }

  return chunks;
}

// ─── Plain-Text Chunker ───────────────────────────────────────────────────────

/**
 * Split plain text into fixed-size chunks using a sliding window with overlap.
 *
 * Strategy:
 *  1. Prefer splitting on sentence boundaries (`. `, `? `, `! `, `\n`).
 *  2. If no sentence boundary is found, split on the nearest word boundary.
 *  3. Overlap: each chunk starts `overlapTokens` tokens before the previous
 *     chunk ended, providing context continuity for FTS5 retrieval.
 *
 * @param content       Raw text string.
 * @param maxTokens     Maximum tokens per chunk (default 500).
 * @param overlapTokens Overlap in tokens (default 50).
 * @returns             Array of chunk strings, each ≤ maxTokens.
 */
export function chunkPlainText(
  content: string,
  maxTokens: number = DEFAULT_MAX_TOKENS,
  overlapTokens: number = DEFAULT_OVERLAP_TOKENS,
): string[] {
  const text = content.trim();
  if (!text) return [];

  if (estimateTokens(text) <= maxTokens) {
    return [text];
  }

  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * CHARS_PER_TOKEN;
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChars, text.length);

    if (end === text.length) {
      // Last chunk — take whatever remains
      chunks.push(text.slice(start).trim());
      break;
    }

    // Try to find a clean split point working backwards from `end`
    const splitAt = findSplitPoint(text, start, end);
    const chunk = text.slice(start, splitAt).trim();
    if (chunk) chunks.push(chunk);

    // Advance with overlap — find where the overlap window starts
    const overlapStart = Math.max(start, splitAt - overlapChars);
    start = overlapStart > start ? overlapStart : splitAt;
  }

  return chunks.filter((c) => c.length > 0);
}

/**
 * Find the best split point in `text[start..end]`, preferring:
 *  1. Sentence-ending punctuation followed by whitespace (`. `, `? `, `! `)
 *  2. Newline characters
 *  3. Whitespace (word boundary)
 *  4. Hard cut at `end` if nothing else is found
 */
function findSplitPoint(text: string, start: number, end: number): number {
  // Search backwards from `end` for a sentence boundary
  const window = text.slice(start, end);
  const sentenceEnd = findLastIndex(window, /[.?!]\s/);
  if (sentenceEnd !== -1) {
    return start + sentenceEnd + 1; // include the punctuation, skip the space
  }

  const newlineIdx = findLastIndex(window, /\n/);
  if (newlineIdx !== -1) {
    return start + newlineIdx + 1;
  }

  const spaceIdx = findLastIndex(window, /\s/);
  if (spaceIdx !== -1) {
    return start + spaceIdx + 1;
  }

  // Hard cut — no natural split found
  return end;
}

/**
 * Find the last occurrence of a pattern in a string.
 * Returns the index or -1 if not found.
 */
function findLastIndex(text: string, pattern: RegExp): number {
  const global = new RegExp(pattern.source, "g" + (pattern.flags.replace("g", "")));
  let last = -1;
  let match: RegExpExecArray | null;
  while ((match = global.exec(text)) !== null) {
    last = match.index;
  }
  return last;
}

// ─── Binary Extractors ────────────────────────────────────────────────────────

/**
 * Extract plain text from a PDF buffer.
 *
 * Requires the `pdf-parse` npm package (not included by default).
 * Install with: `npm install pdf-parse`
 *
 * Enforces a 10 MB buffer limit to prevent OOM on large files.
 *
 * @param buffer  Raw PDF file contents.
 * @returns       Extracted plain text.
 * @throws        If pdf-parse is not installed or the buffer exceeds 10 MB.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  if (buffer.length > MAX_BINARY_BYTES) {
    throw new Error(
      `PDF buffer exceeds 10 MB limit (got ${(buffer.length / 1024 / 1024).toFixed(1)} MB).`,
    );
  }

  // Dynamic import so this module loads without the dep being present
  let pdfParse: (buf: Buffer) => Promise<{ text: string }>;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    pdfParse = require("pdf-parse") as (buf: Buffer) => Promise<{ text: string }>;
  } catch {
    throw new Error(
      "PDF extraction requires the 'pdf-parse' package. " +
        "Install it with: npm install pdf-parse",
    );
  }

  const result = await pdfParse(buffer);
  return result.text;
}

/**
 * Extract plain text from a DOCX buffer using mammoth.
 *
 * Requires the `mammoth` npm package (not included by default).
 * Install with: `npm install mammoth`
 *
 * Enforces a 10 MB buffer limit to prevent OOM on large files.
 *
 * @param buffer  Raw DOCX file contents.
 * @returns       Extracted plain text (HTML tags stripped).
 * @throws        If mammoth is not installed or the buffer exceeds 10 MB.
 */
export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  if (buffer.length > MAX_BINARY_BYTES) {
    throw new Error(
      `DOCX buffer exceeds 10 MB limit (got ${(buffer.length / 1024 / 1024).toFixed(1)} MB).`,
    );
  }

  let mammoth: {
    extractRawText(opts: { buffer: Buffer }): Promise<{ value: string }>;
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mammoth = require("mammoth") as typeof mammoth;
  } catch {
    throw new Error(
      "DOCX extraction requires the 'mammoth' package. " +
        "Install it with: npm install mammoth",
    );
  }

  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}
