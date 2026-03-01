/**
 * Word-compatible HTML document generator.
 *
 * Converts Markdown (or raw HTML) to an HTML document formatted with
 * Microsoft Office Word namespace declarations. This "Word HTML" format
 * (historically the `.doc` / MHT format) is recognized by:
 *   - Microsoft Word 2003+ ("Open in Word")
 *   - LibreOffice / OpenOffice Writer
 *   - Google Drive (auto-converts to Google Doc on upload)
 *   - Apple Pages
 *
 * The output is returned as a UTF-8 HTML string. Callers set the response
 * Content-Type to `application/msword` and file extension to `.doc` so that
 * the OS / browser association opens it in Word.
 *
 * @module
 */

import { markdownToHtml } from "@/lib/markdown/toHtml";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WordDocumentOptions {
  /** Document title (shown in title bar and Word document properties). Default: "Document" */
  title?: string;
  /** Author name for Word document properties. */
  author?: string;
  /** ISO date string. Defaults to today. */
  date?: string;
  /**
   * Input type. If "markdown", converts to HTML first.
   * If "html", embeds as-is inside the body. Default: "markdown"
   */
  inputType?: "markdown" | "html";
  /**
   * Paper size. Affects Word page setup margins.
   * "letter" (default) | "a4"
   */
  paperSize?: "letter" | "a4";
  /** Accent color for headings (CSS hex). Default: #1a2744 */
  accentColor?: string;
  /** Whether to show a title heading at the top of the document. Default: true */
  showTitle?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(isoOrDate?: string): string {
  const d = isoOrDate ? new Date(isoOrDate) : new Date();
  if (isNaN(d.getTime())) return isoOrDate ?? "";
  return d.toLocaleDateString("en-US", { dateStyle: "long" });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convert mm to Word "twips" (twentieths of a point). 1mm ≈ 56.69 twips. */
function mmToTwips(mm: number): number {
  return Math.round(mm * 56.69);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

/**
 * Generate a Word-compatible HTML document from Markdown or HTML content.
 *
 * The returned string should be saved with a `.doc` extension and served
 * with `Content-Type: application/msword`. Word, LibreOffice, and Google Drive
 * all recognize this format and open/convert it correctly.
 *
 * @param content - Markdown or HTML input
 * @param opts    - Document metadata and rendering options
 * @returns Full Word-compatible HTML document string (UTF-8)
 *
 * @example
 *   const doc = toWordHtml("# Proposal\n\nDear Client,", {
 *     title: "Sales Proposal",
 *     author: "Alex",
 *   });
 *   // Upload to Drive as "proposal.doc" with MIME "application/msword"
 */
export function toWordHtml(content: string, opts: WordDocumentOptions = {}): string {
  const {
    title = "Document",
    author,
    date,
    inputType = "markdown",
    paperSize = "letter",
    accentColor = "#1a2744",
    showTitle = true,
  } = opts;

  const bodyHtml = inputType === "markdown" ? markdownToHtml(content) : content;
  const formattedDate = formatDate(date);

  // Word page margins (twips)
  const marginTop = mmToTwips(25.4);    // 1 inch
  const marginBottom = mmToTwips(25.4); // 1 inch
  const marginLeft = mmToTwips(31.75);  // 1.25 inches
  const marginRight = mmToTwips(31.75); // 1.25 inches

  const pageWidth = paperSize === "a4" ? mmToTwips(210) : mmToTwips(215.9);  // A4: 210mm, Letter: 8.5in
  const pageHeight = paperSize === "a4" ? mmToTwips(297) : mmToTwips(279.4); // A4: 297mm, Letter: 11in

  const titleBlock = showTitle
    ? `<h1 style="color: ${accentColor}; font-family: 'Calibri', sans-serif; margin-bottom: 4pt;">${escapeXml(title)}</h1>
       <p style="color: #666; font-family: 'Calibri', sans-serif; font-size: 10pt; margin-top: 0; margin-bottom: 18pt; border-bottom: 1px solid #ccc; padding-bottom: 6pt;">
         ${formattedDate}${author ? ` &nbsp;·&nbsp; ${escapeXml(author)}` : ""}
       </p>`
    : "";

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:w="urn:schemas-microsoft-com:office:word"
  xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="UTF-8" />
  <meta name="ProgId" content="Word.Document" />
  <meta name="Generator" content="openclaw-studio-document-generation" />
  ${author ? `<meta name="Author" content="${escapeXml(author)}" />` : ""}
  <title>${escapeXml(title)}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>90</w:Zoom>
    </w:WordDocument>
    <o:DocumentProperties>
      <o:Title>${escapeXml(title)}</o:Title>
      ${author ? `<o:Author>${escapeXml(author)}</o:Author>` : ""}
    </o:DocumentProperties>
  </xml>
  <xml>
    <w:LatentStyles DefLockedState="false" DefUnhideWhenUsed="true"
      DefSemiHidden="true" DefQFormat="false" DefPriority="99" LatentStyleCount="267">
    </w:LatentStyles>
  </xml>
  <![endif]-->
  <style>
    /* ── Word page setup ─────────────────────────────────────────── */
    @page WordSection1 {
      size: ${pageWidth}pt ${pageHeight}pt;
      margin: ${marginTop}pt ${marginRight}pt ${marginBottom}pt ${marginLeft}pt;
      mso-header-margin: 36pt;
      mso-footer-margin: 36pt;
      mso-paper-source: 0;
    }
    div.WordSection1 { page: WordSection1; }

    /* ── Base typography ─────────────────────────────────────────── */
    body {
      font-family: "Calibri", "Arial", sans-serif;
      font-size: 11pt;
      line-height: 1.5;
      color: #1a1a1a;
    }

    /* ── Headings ────────────────────────────────────────────────── */
    h1 {
      font-size: 18pt; font-weight: bold;
      color: ${accentColor};
      margin-top: 12pt; margin-bottom: 6pt;
      border-bottom: 1px solid #d0d0d0;
      padding-bottom: 3pt;
      mso-style-name: "Heading 1";
    }
    h2 {
      font-size: 14pt; font-weight: bold;
      color: ${accentColor};
      margin-top: 10pt; margin-bottom: 4pt;
      mso-style-name: "Heading 2";
    }
    h3 {
      font-size: 12pt; font-weight: bold;
      color: ${accentColor};
      margin-top: 8pt; margin-bottom: 3pt;
      mso-style-name: "Heading 3";
    }
    h4, h5, h6 {
      font-size: 11pt; font-weight: bold;
      color: ${accentColor};
      margin-top: 6pt; margin-bottom: 2pt;
    }

    /* ── Paragraphs ──────────────────────────────────────────────── */
    p {
      margin-top: 0;
      margin-bottom: 8pt;
      mso-style-name: "Normal";
    }

    /* ── Links ───────────────────────────────────────────────────── */
    a { color: ${accentColor}; }

    /* ── Inline formatting ───────────────────────────────────────── */
    strong { font-weight: bold; }
    em { font-style: italic; }
    del { text-decoration: line-through; color: #666; }

    /* ── Code ────────────────────────────────────────────────────── */
    code {
      font-family: "Courier New", Courier, monospace;
      font-size: 9.5pt;
      background: #f5f5f5;
      padding: 1pt 3pt;
      mso-style-name: "Code";
    }
    pre {
      font-family: "Courier New", Courier, monospace;
      font-size: 9pt;
      background: #f5f5f5;
      border-left: 3pt solid ${accentColor};
      padding: 6pt 8pt;
      margin: 8pt 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      mso-style-name: "Code Block";
    }
    pre code { background: none; padding: 0; }

    /* ── Lists ───────────────────────────────────────────────────── */
    ul, ol {
      margin-top: 4pt;
      margin-bottom: 8pt;
      padding-left: 20pt;
      mso-style-name: "List Paragraph";
    }
    li { margin-bottom: 3pt; }

    /* ── Blockquote ──────────────────────────────────────────────── */
    blockquote {
      border-left: 3pt solid ${accentColor};
      margin: 8pt 0 8pt 12pt;
      padding: 4pt 8pt;
      color: #555;
      font-style: italic;
    }

    /* ── Horizontal rule ─────────────────────────────────────────── */
    hr {
      border: none;
      border-top: 1pt solid #ccc;
      margin: 12pt 0;
    }

    /* ── Tables ──────────────────────────────────────────────────── */
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 8pt 0;
      font-size: 10pt;
      mso-table-lspace: 0;
      mso-table-rspace: 0;
    }
    th {
      background: ${accentColor};
      color: #fff;
      font-weight: bold;
      text-align: left;
      padding: 4pt 6pt;
      border: 1pt solid #999;
    }
    td {
      border: 1pt solid #ccc;
      padding: 3pt 6pt;
      vertical-align: top;
    }
    tr:nth-child(even) td { background: #f9f9f9; }

    /* ── Images ──────────────────────────────────────────────────── */
    img { max-width: 100%; height: auto; display: block; margin: 6pt 0; }
  </style>
</head>
<body>
  <div class="WordSection1">
    ${titleBlock}
    <div class="doc-body">
      ${bodyHtml}
    </div>
  </div>
</body>
</html>`;
}
