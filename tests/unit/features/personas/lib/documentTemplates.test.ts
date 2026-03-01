import { describe, it, expect } from "vitest";
import {
  renderTemplate,
  listDocTemplates,
  getDocTemplate,
  renderDocTemplate,
} from "@/features/personas/lib/documentTemplates";

// ---------------------------------------------------------------------------
// renderTemplate
// ---------------------------------------------------------------------------

describe("renderTemplate", () => {
  it("renders simple variable substitution", () => {
    const result = renderTemplate("Hello, {{name}}!", { name: "Alice" });
    expect(result).toBe("Hello, Alice!");
  });

  it("renders nested data access", () => {
    const result = renderTemplate("{{person.title}} {{person.name}}", {
      person: { title: "Dr.", name: "Bob" },
    });
    expect(result).toBe("Dr. Bob");
  });

  it("renders #if block when truthy", () => {
    const result = renderTemplate("{{#if show}}visible{{/if}}", { show: true });
    expect(result).toBe("visible");
  });

  it("renders nothing for #if block when falsy", () => {
    const result = renderTemplate("{{#if show}}visible{{/if}}", { show: false });
    expect(result).toBe("");
  });

  it("renders #each block over an array", () => {
    const result = renderTemplate("{{#each items}}{{this}} {{/each}}", {
      items: ["a", "b", "c"],
    });
    expect(result).toBe("a b c ");
  });

  it("does not HTML-escape Markdown content", () => {
    const result = renderTemplate("**{{bold}}** & {{other}}", {
      bold: "strong",
      other: "rest",
    });
    expect(result).toBe("**strong** & rest");
  });

  it("returns empty string for undefined variable", () => {
    const result = renderTemplate("{{missing}}", {});
    expect(result).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Built-in helpers
// ---------------------------------------------------------------------------

describe("formatDate helper", () => {
  const date = new Date("2026-03-01T14:30:00.000Z");

  it("formats as iso", () => {
    const result = renderTemplate("{{formatDate date 'iso'}}", { date });
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("formats as short", () => {
    const result = renderTemplate("{{formatDate date 'short'}}", { date });
    expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{2}/);
  });

  it("formats as long", () => {
    const result = renderTemplate("{{formatDate date 'long'}}", { date });
    expect(result).toContain("2026");
  });

  it("returns value as-is when invalid date", () => {
    const result = renderTemplate("{{formatDate date 'long'}}", { date: "not-a-date" });
    expect(result).toBe("not-a-date");
  });
});

describe("currency helper", () => {
  it("formats USD amount", () => {
    const result = renderTemplate("{{currency amount 'USD'}}", { amount: 12500 });
    expect(result).toBe("$12,500.00");
  });

  it("defaults to USD when currency code is invalid", () => {
    const result = renderTemplate("{{currency amount 'xx'}}", { amount: 100 });
    expect(result).toBe("$100.00");
  });

  it("returns raw value when not a number", () => {
    const result = renderTemplate("{{currency amount 'USD'}}", { amount: "N/A" });
    expect(result).toBe("N/A");
  });
});

describe("list helper", () => {
  it("renders array as markdown bullet list", () => {
    const result = renderTemplate("{{{list items}}}", { items: ["Apple", "Banana", "Cherry"] });
    expect(result).toBe("- Apple\n- Banana\n- Cherry");
  });

  it("passes through non-array value", () => {
    const result = renderTemplate("{{{list items}}}", { items: "just a string" });
    expect(result).toBe("just a string");
  });
});

describe("uppercase helper", () => {
  it("uppercases a string", () => {
    const result = renderTemplate("{{uppercase name}}", { name: "acme" });
    expect(result).toBe("ACME");
  });
});

describe("lowercase helper", () => {
  it("lowercases a string", () => {
    const result = renderTemplate("{{lowercase name}}", { name: "ACME" });
    expect(result).toBe("acme");
  });
});

describe("truncate helper", () => {
  it("truncates a string that exceeds the limit", () => {
    const result = renderTemplate("{{truncate text 10}}", { text: "Hello, world!" });
    expect(result).toBe("Hello, wor…");
  });

  it("does not truncate a string within the limit", () => {
    const result = renderTemplate("{{truncate text 100}}", { text: "Short" });
    expect(result).toBe("Short");
  });
});

// ---------------------------------------------------------------------------
// listDocTemplates
// ---------------------------------------------------------------------------

describe("listDocTemplates", () => {
  it("returns document templates for executive-assistant", () => {
    const templates = listDocTemplates("executive-assistant");
    expect(templates.length).toBeGreaterThan(0);
    const filenames = templates.map((t) => t.filename);
    expect(filenames).toContain("meeting-brief.md.hbs");
    expect(filenames).toContain("follow-up-email.md.hbs");
  });

  it("returns document templates for cold-caller", () => {
    const templates = listDocTemplates("cold-caller");
    expect(templates.length).toBeGreaterThan(0);
    const filenames = templates.map((t) => t.filename);
    expect(filenames).toContain("call-summary.md.hbs");
    expect(filenames).toContain("prospect-brief.md.hbs");
  });

  it("returns empty array for unknown persona", () => {
    const templates = listDocTemplates("does-not-exist");
    expect(templates).toEqual([]);
  });

  it("each template has required fields", () => {
    const templates = listDocTemplates("executive-assistant");
    for (const t of templates) {
      expect(t).toHaveProperty("filename");
      expect(t).toHaveProperty("label");
      expect(t).toHaveProperty("description");
      expect(t).toHaveProperty("content");
      expect(t.filename.endsWith(".hbs")).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// getDocTemplate
// ---------------------------------------------------------------------------

describe("getDocTemplate", () => {
  it("returns a template by filename", () => {
    const tpl = getDocTemplate("executive-assistant", "meeting-brief.md.hbs");
    expect(tpl).toBeDefined();
    expect(tpl?.label).toBe("Meeting Brief");
  });

  it("returns undefined for missing filename", () => {
    const tpl = getDocTemplate("executive-assistant", "nonexistent.md.hbs");
    expect(tpl).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// renderDocTemplate
// ---------------------------------------------------------------------------

describe("renderDocTemplate", () => {
  it("renders a named template with data", () => {
    const result = renderDocTemplate("executive-assistant", "meeting-brief.md.hbs", {
      meeting_title: "Q1 Strategy",
      date: new Date("2026-03-01"),
      location: "Zoom",
      attendees: [{ name: "Alice", title: "CEO", company: "Acme" }],
      agenda: ["Review OKRs", "Budget planning"],
      context: "Annual planning session.",
      executive_name: "Mike",
      persona_name: "Alex",
    });
    expect(result).not.toBeNull();
    expect(result).toContain("Q1 Strategy");
    expect(result).toContain("Alice");
    expect(result).toContain("Review OKRs");
  });

  it("returns null for unknown template filename", () => {
    const result = renderDocTemplate(
      "executive-assistant",
      "nonexistent.md.hbs",
      {},
    );
    expect(result).toBeNull();
  });

  it("returns null for unknown persona", () => {
    const result = renderDocTemplate("unknown-persona", "meeting-brief.md.hbs", {});
    expect(result).toBeNull();
  });
});
