/**
 * Print-optimized HTML document generator.
 *
 * Converts Markdown (or raw HTML) to a full, self-contained HTML document
 * styled for printing. When opened in a browser or uploaded to Google Drive
 * (which auto-converts to a Google Doc), it produces a clean, professional
 * single-column document.
 *
 * Design goals:
 *  - Professional typography (Georgia serif body, system-ui headings)
 *  - A4/Letter page layout with generous margins
 *  - @media print: hides UI chrome, forces black-on-white, avoids page breaks
 *    inside headings / code blocks / table rows
 *  - Fully self-contained (no external resources, no JavaScript required)
 *  - Optional branded header / footer via page metadata
 *
 * @module
 */

import { markdownToHtml } from "@/lib/markdown/toHtml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrintDocumentOptions {
  /** Document title used in <title> and optional visible header. Default: "Document" */
  title?: string;
  /** Author name shown in metadata and optional footer. */
  author?: string;
  /** ISO date string for the document date. Defaults to today. */
  date?: string;
  /**
   * Paper size class applied to the .page container.
   * "a4" (210×297mm) | "letter" (8.5×11in). Default: "letter"
   */
  paperSize?: "a4" | "letter";
  /**
   * Input type. If "markdown", converts to HTML first.
   * If "html", embeds as-is inside the body. Default: "markdown"
   */
  inputType?: "markdown" | "html";
  /** Accent color (CSS color value) for headings and borders. Default: #1a2744 (navy) */
  accentColor?: string;
  /** Whether to show a header with title + date. Default: true */
  showHeader?: boolean;
  /** Whether to show a footer with author + page count. Default: false */
  showFooter?: boolean;
}

// ---------------------------------------------------------------------------
// HTML Sanitization
// ---------------------------------------------------------------------------

import sanitize from "sanitize-html";

/**
 * Sanitize raw HTML input to prevent XSS/SSRF vectors.
 * Allows formatting tags but strips scripts, iframes, objects, embeds,
 * event handlers, and dangerous link protocols.
 */
function sanitizeHtmlInput(html: string): string {
  return sanitize(html, {
    allowedTags: sanitize.defaults.allowedTags.concat([
      "img", "h1", "h2", "h3", "h4", "h5", "h6",
      "table", "thead", "tbody", "tr", "th", "td",
      "pre", "code", "blockquote", "hr", "br",
      "dl", "dt", "dd", "figure", "figcaption",
      "span", "div", "p", "ul", "ol", "li",
      "strong", "em", "s", "u", "sub", "sup",
    ]),
    disallowedTagsMode: "discard",
    allowedAttributes: {
      ...sanitize.defaults.allowedAttributes,
      img: ["src", "alt", "width", "height"],
      td: ["colspan", "rowspan", "align"],
      th: ["colspan", "rowspan", "align"],
      span: ["class", "style"],
      div: ["class", "style"],
      p: ["class", "style"],
      code: ["class"],
      pre: ["class"],
    },
    allowedSchemes: ["http", "https", "data"],
    allowedStyles: {
      "*": {
        "text-align": [/.*/],
        "font-weight": [/.*/],
        "font-style": [/.*/],
        "color": [/.*/],
        "background-color": [/.*/],
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoOrDate?: string): string {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  if (isNaN(d.getTime())) return isoOrDate ?? "";
  return d.toLocaleDateString("en-US", { dateStyle: "long" });
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate a complete, print-ready HTML document from Markdown or HTML content.
 *
 * The returned string is a full `<!DOCTYPE html>` document suitable for:
 *  - Serving directly to the browser (user prints via Ctrl+P / Cmd+P)
 *  - Uploading to Google Drive (auto-converts to Google Doc → File > Print > PDF)
 *  - Returning from the `/api/generate/pdf` route
 *
 * @param content - Markdown or HTML input
 * @param opts    - Document metadata and rendering options
 * @returns Full HTML document string (UTF-8)
 *
 * @example
 *   const html = toPrintHtml("# Meeting Brief\n\nAgenda: ...", {
 *     title: "Q1 Planning Brief",
 *     author: "Alex",
 *     date: "2026-03-01",
 *   });
 */
export function toPrintHtml(content: string, opts: PrintDocumentOptions = {}): string {
  const {
    title = "Document",
    author,
    date,
    paperSize = "letter",
    inputType = "markdown",
    accentColor = "#1a2744",
    showHeader = true,
    showFooter = false,
  } = opts;

  const bodyHtml =
    inputType === "markdown" ? markdownToHtml(content) : sanitizeHtmlInput(content);
  const formattedDate = formatDate(date);

  const paperWidth = paperSize === "a4" ? "210mm" : "8.5in";
  const paperHeight = paperSize === "a4" ? "297mm" : "11in";

  const headerHtml =
    showHeader
      ? `<header class="doc-header">
          <div class="doc-title">${escapeTitle(title)}</div>
          ${formattedDate ? `<div class="doc-date">${escapeTitle(formattedDate)}</div>` : ""}
        </header>`
      : "";

  const footerHtml =
    showFooter
      ? `<footer class="doc-footer">
          ${author ? `<span>${escapeTitle(author)}</span>` : ""}
          <span class="page-num"></span>
        </footer>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="generator" content="openclaw-studio-document-generation" />
  ${author ? `<meta name="author" content="${escapeAttr(author)}" />` : ""}
  ${date ? `<meta name="date" content="${escapeAttr(date)}" />` : ""}
  <title>${escapeTitle(title)}</title>
  <style>
    /* ── Reset & base ──────────────────────────────────────────────── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --accent: ${accentColor};
      --text: #1a1a1a;
      --muted: #555;
      --border: #d0d0d0;
      --code-bg: #f5f5f5;
      --paper-w: ${paperWidth};
      --paper-h: ${paperHeight};
    }

    body {
      font-family: Georgia, "Times New Roman", serif;
      font-size: 11pt;
      line-height: 1.65;
      color: var(--text);
      background: #e8e8e8;
      padding: 2rem 1rem;
    }

    /* ── Page container ────────────────────────────────────────────── */
    .page {
      width: var(--paper-w);
      min-height: var(--paper-h);
      margin: 0 auto;
      background: #fff;
      padding: 1in 1.25in;
      box-shadow: 0 2px 16px rgba(0,0,0,0.12);
    }

    /* ── Header ────────────────────────────────────────────────────── */
    .doc-header {
      border-bottom: 2px solid var(--accent);
      margin-bottom: 1.5rem;
      padding-bottom: 0.75rem;
    }
    .doc-title {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 20pt;
      font-weight: 700;
      color: var(--accent);
      line-height: 1.2;
    }
    .doc-date {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 10pt;
      color: var(--muted);
      margin-top: 0.25rem;
    }

    /* ── Body typography ───────────────────────────────────────────── */
    .doc-body { /* content wrapper */ }

    h1, h2, h3, h4, h5, h6 {
      font-family: system-ui, -apple-system, sans-serif;
      font-weight: 700;
      color: var(--accent);
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
      line-height: 1.25;
      page-break-after: avoid;
    }
    h1 { font-size: 16pt; border-bottom: 1px solid var(--border); padding-bottom: 0.25rem; }
    h2 { font-size: 14pt; }
    h3 { font-size: 12pt; }
    h4, h5, h6 { font-size: 11pt; }

    p { margin-bottom: 0.75rem; }

    a { color: var(--accent); }

    strong { font-weight: 700; }
    em { font-style: italic; }
    del { text-decoration: line-through; color: var(--muted); }

    /* ── Code ──────────────────────────────────────────────────────── */
    code {
      font-family: "Courier New", Courier, monospace;
      font-size: 9.5pt;
      background: var(--code-bg);
      padding: 0.1em 0.3em;
      border-radius: 3px;
    }
    pre {
      background: var(--code-bg);
      border-left: 3px solid var(--accent);
      padding: 0.75rem 1rem;
      margin: 1rem 0;
      overflow-x: auto;
      page-break-inside: avoid;
    }
    pre code {
      background: none;
      padding: 0;
      border-radius: 0;
      font-size: 9pt;
      line-height: 1.5;
    }

    /* ── Lists ─────────────────────────────────────────────────────── */
    ul, ol {
      margin: 0.5rem 0 0.75rem 1.5rem;
      padding: 0;
    }
    li { margin-bottom: 0.25rem; }
    li input[type="checkbox"] { margin-right: 0.35em; }

    /* ── Blockquote ────────────────────────────────────────────────── */
    blockquote {
      border-left: 4px solid var(--accent);
      margin: 1rem 0;
      padding: 0.5rem 1rem;
      color: var(--muted);
      font-style: italic;
      page-break-inside: avoid;
    }

    /* ── Horizontal rule ───────────────────────────────────────────── */
    hr {
      border: none;
      border-top: 1px solid var(--border);
      margin: 1.5rem 0;
    }

    /* ── Tables ────────────────────────────────────────────────────── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 1rem 0;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    th {
      background: var(--accent);
      color: #fff;
      font-family: system-ui, -apple-system, sans-serif;
      font-weight: 600;
      text-align: left;
      padding: 0.4rem 0.6rem;
    }
    td {
      border: 1px solid var(--border);
      padding: 0.35rem 0.6rem;
      vertical-align: top;
    }
    tr:nth-child(even) td { background: #f9f9f9; }

    /* ── Images ────────────────────────────────────────────────────── */
    img { max-width: 100%; height: auto; display: block; margin: 0.75rem 0; }

    /* ── Footer ────────────────────────────────────────────────────── */
    .doc-footer {
      border-top: 1px solid var(--border);
      margin-top: 2rem;
      padding-top: 0.5rem;
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 9pt;
      color: var(--muted);
      display: flex;
      justify-content: space-between;
    }

    /* ── Print overrides ───────────────────────────────────────────── */
    @media print {
      body { background: none; padding: 0; }
      .page { box-shadow: none; margin: 0; padding: 0.75in 1in; width: 100%; min-height: unset; }
      a { color: var(--text); }
      pre { white-space: pre-wrap; }
      h1, h2, h3 { page-break-after: avoid; }
      table, pre, blockquote, img { page-break-inside: avoid; }

      @page {
        size: ${paperSize === "a4" ? "A4" : "letter"};
        margin: 0.75in 1in;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    ${headerHtml}
    <div class="doc-body">
      ${bodyHtml}
    </div>
    ${footerHtml}
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function escapeTitle(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
