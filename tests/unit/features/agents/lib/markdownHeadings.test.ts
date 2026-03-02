import { describe, it, expect } from "vitest";
import {
  extractHeadings,
  type MarkdownHeading,
} from "@/features/agents/lib/markdownHeadings";

// ── Helpers ────────────────────────────────────────────────────────────────

function h(level: number, text: string, lineNumber: number): MarkdownHeading {
  return { level, text, lineNumber };
}

// ── Basic extraction ───────────────────────────────────────────────────────

describe("extractHeadings", () => {
  it("returns empty array for empty string", () => {
    expect(extractHeadings("")).toEqual([]);
  });

  it("returns empty array for content with no headings", () => {
    expect(extractHeadings("Just some plain text\nNo headings here.")).toEqual([]);
  });

  it("extracts a single h1", () => {
    expect(extractHeadings("# Hello World")).toEqual([h(1, "Hello World", 1)]);
  });

  it("extracts h1 through h6", () => {
    const content = [
      "# H1",
      "## H2",
      "### H3",
      "#### H4",
      "##### H5",
      "###### H6",
    ].join("\n");
    expect(extractHeadings(content)).toEqual([
      h(1, "H1", 1),
      h(2, "H2", 2),
      h(3, "H3", 3),
      h(4, "H4", 4),
      h(5, "H5", 5),
      h(6, "H6", 6),
    ]);
  });

  it("records correct 1-indexed line numbers", () => {
    const content = "line 0\nline 1\n## Section\nline 3";
    const headings = extractHeadings(content);
    expect(headings).toHaveLength(1);
    expect(headings[0].lineNumber).toBe(3);
  });

  it("trims heading text", () => {
    const content = "##   Spaces Around   ";
    const headings = extractHeadings(content);
    expect(headings[0].text).toBe("Spaces Around");
  });

  it("requires a space after # characters", () => {
    // '#Title' (no space) should NOT be treated as heading
    expect(extractHeadings("#NoSpace")).toEqual([]);
    expect(extractHeadings("##AlsoNoSpace")).toEqual([]);
  });

  it("does not match more than 6 # characters as heading level", () => {
    // 7 hashes — not a valid ATX heading
    const headings = extractHeadings("####### Too deep");
    expect(headings).toHaveLength(0);
  });

  // ── Code block skipping ────────────────────────────────────────────────

  describe("code block awareness", () => {
    it("skips headings inside backtick fenced code blocks", () => {
      const content = [
        "# Real heading",
        "```",
        "# Fake heading inside code",
        "```",
        "## Another real heading",
      ].join("\n");
      const headings = extractHeadings(content);
      expect(headings).toEqual([h(1, "Real heading", 1), h(2, "Another real heading", 5)]);
    });

    it("skips headings inside tilde fenced code blocks", () => {
      const content = [
        "# Real heading",
        "~~~",
        "## Fake inside tilde block",
        "~~~",
      ].join("\n");
      const headings = extractHeadings(content);
      expect(headings).toEqual([h(1, "Real heading", 1)]);
    });

    it("handles code block with language specifier", () => {
      const content = [
        "# Before",
        "```typescript",
        "# Inside TypeScript block",
        "```",
        "# After",
      ].join("\n");
      const headings = extractHeadings(content);
      expect(headings).toEqual([h(1, "Before", 1), h(1, "After", 5)]);
    });

    it("handles indented code fence opener", () => {
      // Leading whitespace before ``` still counts
      const content = ["# Before", "  ```", "# Inside", "  ```", "# After"].join("\n");
      const headings = extractHeadings(content);
      expect(headings).toEqual([h(1, "Before", 1), h(1, "After", 5)]);
    });

    it("handles adjacent code blocks", () => {
      const content = [
        "# H1",
        "```",
        "# skip",
        "```",
        "# H2",
        "```",
        "# skip2",
        "```",
        "# H3",
      ].join("\n");
      const headings = extractHeadings(content);
      expect(headings).toEqual([h(1, "H1", 1), h(1, "H2", 5), h(1, "H3", 9)]);
    });

    it("treats unclosed code block as in-code through EOF", () => {
      const content = ["# Before", "```", "# Inside (unclosed block)", "# Also inside"].join(
        "\n"
      );
      const headings = extractHeadings(content);
      expect(headings).toEqual([h(1, "Before", 1)]);
    });
  });

  // ── Frontmatter skipping ───────────────────────────────────────────────

  describe("frontmatter awareness", () => {
    it("skips headings inside YAML frontmatter", () => {
      const content = [
        "---",
        "title: My Doc",
        "# Not a heading",
        "---",
        "# Real heading",
      ].join("\n");
      const headings = extractHeadings(content);
      expect(headings).toEqual([h(1, "Real heading", 5)]);
    });

    it("frontmatter only triggers on line 0", () => {
      const content = [
        "Some intro text",
        "---",
        "title: Not frontmatter",
        "---",
        "# Real heading",
      ].join("\n");
      const headings = extractHeadings(content);
      expect(headings).toHaveLength(1);
      expect(headings[0].text).toBe("Real heading");
    });

    it("frontmatter can be closed with ...", () => {
      const content = ["---", "key: val", "...", "# Real heading"].join("\n");
      const headings = extractHeadings(content);
      expect(headings).toEqual([h(1, "Real heading", 4)]);
    });

    it("returns empty when document is only frontmatter", () => {
      const content = ["---", "title: Only frontmatter", "---"].join("\n");
      expect(extractHeadings(content)).toEqual([]);
    });
  });

  // ── SOUL.md scenario ───────────────────────────────────────────────────

  describe("real-world scenarios", () => {
    it("extracts expected sections from a SOUL.md-style file", () => {
      const soul = [
        "# SOUL.md — Who Alex Is",
        "",
        "## Core Identity",
        "I'm a builder agent.",
        "",
        "## Personality",
        "Direct and competent.",
        "",
        "## Work Style",
        "Read files, verify, ship.",
        "",
        "## Boundaries",
        "No exfiltrating data.",
        "",
        "## Continuity",
        "Memory files are my continuity.",
      ].join("\n");
      const headings = extractHeadings(soul);
      expect(headings.map((h) => h.text)).toEqual([
        "SOUL.md — Who Alex Is",
        "Core Identity",
        "Personality",
        "Work Style",
        "Boundaries",
        "Continuity",
      ]);
      expect(headings.map((h) => h.level)).toEqual([1, 2, 2, 2, 2, 2]);
    });

    it("skips headings in code examples inside AGENTS.md-style file", () => {
      const agents = [
        "# AGENTS.md",
        "",
        "## Coding Standards",
        "Do not do bad things.",
        "",
        "### Example",
        "```markdown",
        "## This is inside a code block example",
        "```",
        "",
        "## Memory",
        "Write it down.",
      ].join("\n");
      const headings = extractHeadings(agents);
      expect(headings.map((h) => h.text)).toEqual([
        "AGENTS.md",
        "Coding Standards",
        "Example",
        "Memory",
      ]);
    });
  });
});
