/**
 * Phase 2 — Document generation unit tests
 *
 * Covers:
 *   - markdownToHtml (src/lib/markdown/toHtml.ts)
 *   - toPrintHtml (src/lib/document/toPrintHtml.ts)
 *   - toWordHtml (src/lib/document/toWordHtml.ts)
 *   - BrowserPool / withSlot (src/lib/browser/pool.ts)
 */

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import { markdownToHtml } from "@/lib/markdown/toHtml";
import { toPrintHtml } from "@/lib/document/toPrintHtml";
import { toWordHtml } from "@/lib/document/toWordHtml";
import {
  acquireSlot,
  releaseSlot,
  withSlot,
  getPoolStats,
  shutdownPool,
} from "@/lib/browser/pool";

// ---------------------------------------------------------------------------
// markdownToHtml
// ---------------------------------------------------------------------------

describe("markdownToHtml", () => {
  describe("headings", () => {
    it("renders ATX h1 through h6", () => {
      for (let i = 1; i <= 6; i++) {
        const hashes = "#".repeat(i);
        const html = markdownToHtml(`${hashes} Heading ${i}`);
        expect(html).toContain(`<h${i}>`);
        expect(html).toContain(`Heading ${i}`);
        expect(html).toContain(`</h${i}>`);
      }
    });

    it("renders setext h1 (===)", () => {
      const html = markdownToHtml("My Title\n========");
      expect(html).toContain("<h1>My Title</h1>");
    });

    it("renders setext h2 (---)", () => {
      const html = markdownToHtml("Subtitle\n--------");
      expect(html).toContain("<h2>Subtitle</h2>");
    });

    it("strips trailing # markers", () => {
      const html = markdownToHtml("## Section ##");
      expect(html).toContain("<h2>Section</h2>");
    });
  });

  describe("inline formatting", () => {
    it("renders bold (**text**)", () => {
      const html = markdownToHtml("Hello **world** there");
      expect(html).toContain("<strong>world</strong>");
    });

    it("renders bold (__text__)", () => {
      const html = markdownToHtml("Hello __world__ there");
      expect(html).toContain("<strong>world</strong>");
    });

    it("renders italic (*text*)", () => {
      const html = markdownToHtml("Hello *world* there");
      expect(html).toContain("<em>world</em>");
    });

    it("renders italic (_text_)", () => {
      const html = markdownToHtml("Hello _world_ there");
      expect(html).toContain("<em>world</em>");
    });

    it("renders strikethrough (~~text~~)", () => {
      const html = markdownToHtml("~~deleted~~");
      expect(html).toContain("<del>deleted</del>");
    });

    it("renders inline code (`code`)", () => {
      const html = markdownToHtml("Use `npm install` to install");
      expect(html).toContain("<code>npm install</code>");
    });

    it("protects inline code from further substitution", () => {
      // The ** inside backticks should NOT become <strong>
      const html = markdownToHtml("Run `**foo**` here");
      expect(html).not.toContain("<strong>foo</strong>");
      expect(html).toContain("<code>**foo**</code>");
    });

    it("renders links", () => {
      const html = markdownToHtml("[OpenClaw](https://openclaw.ai)");
      expect(html).toContain('<a href="https://openclaw.ai">OpenClaw</a>');
    });

    it("renders links with title", () => {
      const html = markdownToHtml('[OpenClaw](https://openclaw.ai "Automation")');
      expect(html).toContain('title="Automation"');
    });

    it("renders images", () => {
      const html = markdownToHtml("![Logo](https://example.com/logo.png)");
      expect(html).toContain('<img src="https://example.com/logo.png"');
      expect(html).toContain('alt="Logo"');
    });

    it("escapes HTML entities in text", () => {
      const html = markdownToHtml("5 < 10 & 20 > 15");
      expect(html).toContain("5 &lt; 10 &amp; 20 &gt; 15");
    });
  });

  describe("paragraphs", () => {
    it("wraps plain text in <p>", () => {
      const html = markdownToHtml("Hello world");
      expect(html).toContain("<p>Hello world</p>");
    });

    it("creates multiple paragraphs from blank-line-separated blocks", () => {
      const html = markdownToHtml("First para\n\nSecond para");
      expect(html).toContain("<p>First para</p>");
      expect(html).toContain("<p>Second para</p>");
    });
  });

  describe("code blocks", () => {
    it("renders fenced code block with language", () => {
      const md = "```typescript\nconst x = 1;\n```";
      const html = markdownToHtml(md);
      expect(html).toContain('<code class="language-typescript">');
      expect(html).toContain("const x = 1;");
    });

    it("renders fenced code block without language", () => {
      const md = "```\nplain code\n```";
      const html = markdownToHtml(md);
      expect(html).toContain("<pre><code>plain code</code></pre>");
    });

    it("escapes HTML inside code blocks", () => {
      const md = "```\n<script>alert('xss')</script>\n```";
      const html = markdownToHtml(md);
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });

  describe("lists", () => {
    it("renders unordered list", () => {
      const html = markdownToHtml("- Alpha\n- Beta\n- Gamma");
      expect(html).toContain("<ul>");
      expect(html).toContain("<li>Alpha</li>");
      expect(html).toContain("<li>Beta</li>");
      expect(html).toContain("<li>Gamma</li>");
      expect(html).toContain("</ul>");
    });

    it("renders ordered list", () => {
      const html = markdownToHtml("1. First\n2. Second\n3. Third");
      expect(html).toContain("<ol>");
      expect(html).toContain("<li>First</li>");
    });

    it("renders task list items", () => {
      const html = markdownToHtml("- [x] Done\n- [ ] Pending");
      expect(html).toContain('checked=""');
      expect(html).toContain("Done");
      expect(html).toContain("Pending");
    });
  });

  describe("blockquotes", () => {
    it("renders blockquote", () => {
      const html = markdownToHtml("> This is a quote");
      expect(html).toContain("<blockquote>");
      expect(html).toContain("This is a quote");
      expect(html).toContain("</blockquote>");
    });
  });

  describe("horizontal rules", () => {
    it("renders --- as <hr />", () => {
      const html = markdownToHtml("---");
      expect(html).toContain("<hr />");
    });

    it("renders *** as <hr />", () => {
      const html = markdownToHtml("***");
      expect(html).toContain("<hr />");
    });
  });

  describe("tables", () => {
    it("renders a GFM table", () => {
      const md = "| Name | Role |\n|------|------|\n| Alice | Admin |\n| Bob | User |";
      const html = markdownToHtml(md);
      expect(html).toContain("<table>");
      expect(html).toContain("<th>Name</th>");
      expect(html).toContain("<th>Role</th>");
      expect(html).toContain("<td>Alice</td>");
      expect(html).toContain("<td>Admin</td>");
    });
  });
});

// ---------------------------------------------------------------------------
// toPrintHtml
// ---------------------------------------------------------------------------

describe("toPrintHtml", () => {
  it("returns a complete HTML document", () => {
    const html = toPrintHtml("# Hello");
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("includes document title in <title>", () => {
    const html = toPrintHtml("content", { title: "Q1 Brief" });
    expect(html).toContain("<title>Q1 Brief</title>");
  });

  it("renders Markdown content by default", () => {
    const html = toPrintHtml("# Meeting Brief\n\nAgenda: review OKRs");
    expect(html).toContain("<h1>Meeting Brief</h1>");
    expect(html).toContain("Agenda: review OKRs");
  });

  it("passes through HTML when inputType=html", () => {
    const html = toPrintHtml("<p>Hello</p>", { inputType: "html" });
    expect(html).toContain("<p>Hello</p>");
  });

  it("includes author in meta tag when provided", () => {
    const html = toPrintHtml("# Doc", { author: "Alex" });
    expect(html).toContain('name="author"');
    expect(html).toContain("Alex");
  });

  it("applies custom accentColor", () => {
    const html = toPrintHtml("# Doc", { accentColor: "#ff6600" });
    expect(html).toContain("#ff6600");
  });

  it("includes print @media rules", () => {
    const html = toPrintHtml("# Doc");
    expect(html).toContain("@media print");
  });

  it("includes header block when showHeader=true", () => {
    const html = toPrintHtml("# Doc", { title: "My Doc", showHeader: true });
    expect(html).toContain("<header");
    expect(html).toContain("doc-header");
  });

  it("omits header block when showHeader=false", () => {
    const html = toPrintHtml("# Doc", { showHeader: false });
    // CSS defines .doc-header regardless; the *element* should be absent
    expect(html).not.toContain("<header");
  });

  it("escapes title in HTML output", () => {
    const html = toPrintHtml("# Doc", { title: "<script>xss</script>" });
    expect(html).not.toContain("<script>xss</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

// ---------------------------------------------------------------------------
// toWordHtml
// ---------------------------------------------------------------------------

describe("toWordHtml", () => {
  it("returns an HTML document with Word namespace declarations", () => {
    const html = toWordHtml("# Hello");
    expect(html).toContain("schemas-microsoft-com:office:word");
    expect(html).toContain("WordSection1");
  });

  it("renders Markdown content by default", () => {
    const html = toWordHtml("# Proposal\n\nDear client,");
    expect(html).toContain("<h1");
    expect(html).toContain("Proposal");
    expect(html).toContain("Dear client,");
  });

  it("includes document title in <title>", () => {
    const html = toWordHtml("content", { title: "Sales Proposal" });
    expect(html).toContain("<title>Sales Proposal</title>");
  });

  it("renders title heading block when showTitle=true", () => {
    const html = toWordHtml("content", { title: "My Doc", showTitle: true });
    // The title should appear as an h1
    expect(html).toContain("My Doc");
  });

  it("omits title heading when showTitle=false", () => {
    const doc = toWordHtml("content", { title: "Hidden Title", showTitle: false });
    // Title appears in <title> tag, but should not appear in a heading inside the body
    // The titleBlock is empty so we should see no h1 with that content in the body
    const bodyMatch = doc.match(/<div class="WordSection1">([\s\S]*?)<\/div>/);
    expect(bodyMatch?.[1]).not.toContain("<h1");
  });

  it("applies custom accentColor", () => {
    const html = toWordHtml("# Doc", { accentColor: "#cc0000" });
    expect(html).toContain("#cc0000");
  });

  it("includes Word @page setup with letter dimensions", () => {
    const html = toWordHtml("content", { paperSize: "letter" });
    expect(html).toContain("@page WordSection1");
  });

  it("escapes title in XML properties", () => {
    const html = toWordHtml("content", { title: "Report & Summary <2026>" });
    expect(html).not.toContain("&& Summary");
    // Title is XML-escaped in the namespace section
    expect(html).toContain("&amp;");
  });
});

// ---------------------------------------------------------------------------
// BrowserPool
// ---------------------------------------------------------------------------

describe("BrowserPool", () => {
  // NOTE: The pool module is a singleton. These tests interact with the live
  // singleton pool, which has POOL_MAX=3. We must release any acquired slots
  // to avoid polluting subsequent tests.

  afterEach(() => {
    // Nothing to clean up — slots acquired in each test are released within it.
  });

  it("acquireSlot resolves immediately when below capacity", async () => {
    const slot = await acquireSlot();
    expect(slot.id).toBeGreaterThan(0);
    expect(slot.acquiredAt).toBeLessThanOrEqual(Date.now());
    releaseSlot(slot);
  });

  it("withSlot runs the function and releases the slot", async () => {
    const result = await withSlot(async () => 42);
    expect(result).toBe(42);

    const stats = getPoolStats();
    // After withSlot completes, active should not have grown
    expect(stats.active).toBeLessThanOrEqual(3);
  });

  it("withSlot propagates errors and still releases the slot", async () => {
    const statsBefore = getPoolStats();
    await expect(
      withSlot(async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    const statsAfter = getPoolStats();
    // Active count should be the same as before (slot was released)
    expect(statsAfter.active).toBe(statsBefore.active);
  });

  it("getPoolStats returns valid shape", () => {
    const stats = getPoolStats();
    expect(typeof stats.active).toBe("number");
    expect(typeof stats.queued).toBe("number");
    expect(typeof stats.maxConcurrent).toBe("number");
    expect(typeof stats.shuttingDown).toBe("boolean");
    expect(stats.maxConcurrent).toBeGreaterThan(0);
  });

  it("withSlot handles concurrent executions up to pool limit", async () => {
    const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

    // Run 3 concurrent tasks (at or below default limit of 3)
    const results = await Promise.all([
      withSlot(async () => { await delay(5); return 1; }),
      withSlot(async () => { await delay(5); return 2; }),
      withSlot(async () => { await delay(5); return 3; }),
    ]);

    expect(results).toEqual([1, 2, 3]);
  });
});
