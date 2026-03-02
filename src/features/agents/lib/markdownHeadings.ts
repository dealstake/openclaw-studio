/** Heading extracted from markdown content */
export interface MarkdownHeading {
  /** Heading level: 1 = `#`, 2 = `##`, …, 6 = `######` */
  level: number;
  /** Heading text (trimmed, without the `#` prefix) */
  text: string;
  /** 1-indexed line number in the content string */
  lineNumber: number;
}

/**
 * Extract headings from markdown content.
 *
 * Skips headings inside:
 * - Fenced code blocks (``` or ~~~)
 * - YAML frontmatter (--- ... ---)
 *
 * Returns headings in document order with their 1-indexed line numbers.
 */
export function extractHeadings(content: string): MarkdownHeading[] {
  const lines = content.split("\n");
  const headings: MarkdownHeading[] = [];
  let inCodeBlock = false;
  let inFrontmatter = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Frontmatter: only starts on line 0
    if (i === 0 && line.trim() === "---") {
      inFrontmatter = true;
      continue;
    }
    if (inFrontmatter) {
      if (line.trim() === "---" || line.trim() === "...") {
        inFrontmatter = false;
      }
      continue;
    }

    // Fenced code blocks (``` or ~~~)
    if (line.trimStart().startsWith("```") || line.trimStart().startsWith("~~~")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    // ATX-style headings: # Heading
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].trim(),
        lineNumber: i + 1,
      });
    }
  }

  return headings;
}
