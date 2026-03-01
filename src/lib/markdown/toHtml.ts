/**
 * Markdown → HTML converter — zero dependencies.
 *
 * Handles the CommonMark subset most commonly produced by LLM / Handlebars
 * document templates:
 *   - ATX headings (# through ######)
 *   - Setext headings (=== and --- underlines)
 *   - Paragraphs and hard line breaks (trailing double-space)
 *   - Bold (**text** / __text__)
 *   - Italic (*text* / _text_)
 *   - Strikethrough (~~text~~)
 *   - Inline code (`code`)
 *   - Fenced code blocks (``` lang … ```)
 *   - Unordered lists (-, *, +)
 *   - Ordered lists (1. item)
 *   - Nested lists (2-space or 4-space indent)
 *   - Blockquotes (> text)
 *   - Horizontal rules (---, ***, ___)
 *   - Links ([text](url "title"))
 *   - Images (![alt](url "title"))
 *   - Tables (GFM-style | col | col |)
 *   - Task list items (- [ ] / - [x])
 *
 * Intentionally NOT supported (out of scope for document generation):
 *   - HTML passthrough (sanitized out)
 *   - Footnotes
 *   - Definition lists
 *
 * @module
 */

// ---------------------------------------------------------------------------
// Escape helpers
// ---------------------------------------------------------------------------

/** Escape special HTML characters in plain text. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------------------------------------------------------------------
// Inline rendering
// ---------------------------------------------------------------------------

/**
 * Process inline Markdown tokens within a line of text.
 * Applied after block-level structure has been determined.
 *
 * Processing order (important for correctness):
 *   1. Extract code spans, images, and links → protect as sentinels
 *   2. HTML-escape the remaining raw text (& < >)
 *   3. Apply bold / italic / strikethrough (inner content already escaped)
 *   4. Restore protected HTML from sentinels
 *
 * This order ensures raw text is safely escaped while markdown-generated HTML
 * elements are emitted verbatim.
 */
function renderInline(text: string): string {
  const spans: string[] = [];

  // ── 1a. Protect inline code spans ──────────────────────────────────────
  let out = text.replace(/`([^`]+)`/g, (_m, code: string) => {
    const idx = spans.length;
    spans.push(`<code>${escapeHtml(code)}</code>`);
    return `\x00SPAN${idx}\x00`;
  });

  // ── 1b. Protect images (before links to avoid double-matching ![...]) ──
  out = out.replace(
    /!\[([^\]]*)\]\(([^)\s"]+)(?:\s+"([^"]*)")?\)/g,
    (_m, alt: string, src: string, title?: string) => {
      const idx = spans.length;
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      spans.push(`<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${titleAttr} />`);
      return `\x00SPAN${idx}\x00`;
    },
  );

  // ── 1c. Protect links ────────────────────────────────────────────────
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s"]+)(?:\s+"([^"]*)")?\)/g,
    (_m, label: string, href: string, title?: string) => {
      const idx = spans.length;
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
      spans.push(`<a href="${escapeHtml(href)}"${titleAttr}>${renderInlineSimple(label)}</a>`);
      return `\x00SPAN${idx}\x00`;
    },
  );

  // ── 2. HTML-escape raw text ─────────────────────────────────────────
  // The sentinel bytes (\x00) don't conflict with HTML entity chars so they
  // survive this step intact. Markdown syntax chars (* _ ~ `) don't overlap
  // with HTML entity chars so they are safe to escape here.
  out = out
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // ── 3. Apply remaining inline markdown (inner content already escaped) ──
  // Strikethrough
  out = out.replace(/~~([^~]+)~~/g, (_m, inner: string) => `<del>${inner}</del>`);

  // Bold + italic (***text***)
  out = out.replace(/\*{3}([^*]+)\*{3}/g, (_m, inner: string) => `<strong><em>${inner}</em></strong>`);

  // Bold (**text** or __text__)
  out = out.replace(/\*{2}([^*]+)\*{2}/g, (_m, inner: string) => `<strong>${inner}</strong>`);
  out = out.replace(/_{2}([^_]+)_{2}/g, (_m, inner: string) => `<strong>${inner}</strong>`);

  // Italic (*text* or _text_) — only when not adjacent to another * or _
  out = out.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_m, inner: string) => `<em>${inner}</em>`);
  out = out.replace(/(?<!_)_([^_]+)_(?!_)/g, (_m, inner: string) => `<em>${inner}</em>`);

  // Hard line break (two trailing spaces)
  out = out.replace(/  \n/g, "<br />\n");

  // ── 4. Restore protected HTML ────────────────────────────────────────
  out = out.replace(/\x00SPAN(\d+)\x00/g, (_m, idx: string) => spans[parseInt(idx, 10)] ?? "");

  return out;
}

/** Lighter version for nested calls (no link/image recursion). */
function renderInlineSimple(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/\*{2}([^*]+)\*{2}/g, (_m, inner: string) => `<strong>${inner}</strong>`);
  out = out.replace(/\*([^*]+)\*/g, (_m, inner: string) => `<em>${inner}</em>`);
  return out;
}

// ---------------------------------------------------------------------------
// Block-level rendering
// ---------------------------------------------------------------------------

interface ListItem {
  content: string;
  indent: number;
  ordered: boolean;
  start?: number; // only for first ordered item
  checked?: boolean; // task list
}

function parseListItem(line: string): ListItem | null {
  // Unordered: optional indent + (- * +) + space
  const ul = /^( *)[-*+] (?:\[([ x])\] )?(.*)$/.exec(line);
  if (ul) {
    const indent = ul[1]?.length ?? 0;
    const checkMark = ul[2];
    const content = ul[3] ?? "";
    return {
      content,
      indent,
      ordered: false,
      checked: checkMark === undefined ? undefined : checkMark === "x",
    };
  }

  // Ordered: optional indent + (digit+.) + space
  const ol = /^( *)(\d+)\. (.*)$/.exec(line);
  if (ol) {
    const indent = ol[1]?.length ?? 0;
    const start = parseInt(ol[2] ?? "1", 10);
    const content = ol[3] ?? "";
    return { content, indent, ordered: true, start };
  }

  return null;
}

/**
 * Render a list block (contiguous list lines) to HTML.
 * Handles nesting via indent, and mixed ordered/unordered.
 */
function renderList(lines: string[]): string {
  const items = lines.map(parseListItem).filter(Boolean) as ListItem[];
  if (items.length === 0) return "";

  const result: string[] = [];
  const stack: Array<{ tag: "ul" | "ol"; indent: number }> = [];

  for (const item of items) {
    const tag: "ul" | "ol" = item.ordered ? "ol" : "ul";
    const currentIndent = item.indent;

    // Close deeper levels
    while (stack.length > 0 && (stack[stack.length - 1]?.indent ?? 0) > currentIndent) {
      const popped = stack.pop();
      result.push(`</${popped?.tag ?? "ul"}>`);
    }

    // Open new level if needed
    const currentTop = stack[stack.length - 1];
    if (!currentTop || currentTop.indent < currentIndent || currentTop.tag !== tag) {
      const startAttr = tag === "ol" && item.start !== undefined && item.start !== 1
        ? ` start="${item.start}"`
        : "";
      result.push(`<${tag}${startAttr}>`);
      stack.push({ tag, indent: currentIndent });
    }

    // Task list checkbox
    let checkboxHtml = "";
    if (item.checked !== undefined) {
      const checked = item.checked ? ' checked=""' : "";
      checkboxHtml = `<input type="checkbox" disabled${checked} /> `;
    }

    result.push(`<li>${checkboxHtml}${renderInline(item.content)}</li>`);
  }

  // Close remaining open lists
  while (stack.length > 0) {
    const popped = stack.pop();
    result.push(`</${popped?.tag ?? "ul"}>`);
  }

  return result.join("\n");
}

/**
 * Render a GFM table block to HTML.
 * Lines: header row | separator row | data rows
 */
function renderTable(lines: string[]): string {
  if (lines.length < 2) return lines.join("\n");

  const parseRow = (line: string): string[] =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());

  const headerCells = parseRow(lines[0] ?? "");
  // lines[1] is the separator — skip it
  const bodyLines = lines.slice(2);

  const thead = headerCells.map((c) => `<th>${renderInline(c)}</th>`).join("");
  const tbody = bodyLines
    .map((row) => {
      const cells = parseRow(row);
      return "<tr>" + cells.map((c) => `<td>${renderInline(c)}</td>`).join("") + "</tr>";
    })
    .join("\n");

  return `<table>\n<thead><tr>${thead}</tr></thead>\n<tbody>\n${tbody}\n</tbody>\n</table>`;
}

/**
 * Check if a line is a GFM table separator row (e.g. |---|:---:|---:|).
 * Must contain at least one pipe to distinguish from setext heading underlines.
 */
function isTableSeparator(line: string): boolean {
  return /^\|?[\s|:\-]+\|?$/.test(line) && line.includes("-") && line.includes("|");
}

/** Check if a line starts a table (contains at least one |). */
function isTableLine(line: string): boolean {
  return line.includes("|");
}

// ---------------------------------------------------------------------------
// Main converter
// ---------------------------------------------------------------------------

/**
 * Convert a Markdown string to an HTML fragment (no `<html>` wrapper).
 *
 * The output is a sequence of block-level HTML elements suitable for embedding
 * inside a `<body>` or a styled container `<div>`.
 *
 * @param markdown - Input Markdown text
 * @returns        - HTML string (fragment, not a full document)
 *
 * @example
 *   import { markdownToHtml } from "@/lib/markdown/toHtml";
 *   const html = markdownToHtml("# Hello\n\nWorld");
 *   // → "<h1>Hello</h1>\n<p>World</p>"
 */
export function markdownToHtml(markdown: string): string {
  // Normalize line endings
  const input = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = input.split("\n");

  const output: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    // ── Fenced code block ──────────────────────────────────────────────────
    const fenceMatch = /^(`{3,}|~{3,})\s*(\S*)/.exec(line);
    if (fenceMatch) {
      const fence = fenceMatch[1] ?? "```";
      const lang = fenceMatch[2] ?? "";
      const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : "";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]?.startsWith(fence)) {
        codeLines.push(escapeHtml(lines[i] ?? ""));
        i++;
      }
      i++; // skip closing fence
      output.push(`<pre><code${langAttr}>${codeLines.join("\n")}</code></pre>`);
      continue;
    }

    // ── ATX heading ───────────────────────────────────────────────────────
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1]?.length ?? 1;
      const text = headingMatch[2] ?? "";
      // Strip optional trailing # marks
      const clean = text.replace(/\s+#+\s*$/, "");
      output.push(`<h${level}>${renderInline(clean)}</h${level}>`);
      i++;
      continue;
    }

    // ── Setext heading ─────────────────────────────────────────────────────
    const nextLine = lines[i + 1] ?? "";
    if (/^=+\s*$/.test(nextLine) && line.trim()) {
      output.push(`<h1>${renderInline(line)}</h1>`);
      i += 2;
      continue;
    }
    if (/^-+\s*$/.test(nextLine) && line.trim() && !isTableSeparator(nextLine)) {
      output.push(`<h2>${renderInline(line)}</h2>`);
      i += 2;
      continue;
    }

    // ── Horizontal rule ───────────────────────────────────────────────────
    if (/^(?:\*{3,}|-{3,}|_{3,})\s*$/.test(line)) {
      output.push("<hr />");
      i++;
      continue;
    }

    // ── Blockquote ────────────────────────────────────────────────────────
    if (line.startsWith(">")) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i]?.startsWith(">")) {
        quoteLines.push((lines[i] ?? "").replace(/^>\s?/, ""));
        i++;
      }
      const inner = markdownToHtml(quoteLines.join("\n"));
      output.push(`<blockquote>\n${inner}\n</blockquote>`);
      continue;
    }

    // ── List block ────────────────────────────────────────────────────────
    if (parseListItem(line)) {
      const listLines: string[] = [];
      while (i < lines.length && parseListItem(lines[i] ?? "")) {
        listLines.push(lines[i] ?? "");
        i++;
      }
      output.push(renderList(listLines));
      continue;
    }

    // ── Table ─────────────────────────────────────────────────────────────
    if (isTableLine(line) && isTableLine(lines[i + 1] ?? "") && isTableSeparator(lines[i + 1] ?? "")) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableLine(lines[i] ?? "")) {
        tableLines.push(lines[i] ?? "");
        i++;
      }
      output.push(renderTable(tableLines));
      continue;
    }

    // ── Blank line ────────────────────────────────────────────────────────
    if (!line.trim()) {
      i++;
      continue;
    }

    // ── Paragraph ─────────────────────────────────────────────────────────
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i]?.trim() &&
      !parseListItem(lines[i] ?? "") &&
      !/^#{1,6}\s/.test(lines[i] ?? "") &&
      !/^(`{3,}|~{3,})/.test(lines[i] ?? "") &&
      !/^(?:\*{3,}|-{3,}|_{3,})\s*$/.test(lines[i] ?? "") &&
      !lines[i]?.startsWith(">")
    ) {
      paraLines.push(lines[i] ?? "");
      i++;
    }
    if (paraLines.length > 0) {
      output.push(`<p>${renderInline(paraLines.join(" "))}</p>`);
    }
  }

  return output.join("\n");
}
