import { describe, it, expect } from "vitest";
import { parseIndex, updateRowStatus, removeRow, appendRow } from "@/features/projects/lib/indexTable";

const SAMPLE_INDEX = `# Projects Index

| Project | Doc | Status | Priority | One-liner |
|---------|-----|--------|----------|-----------|
| Alpha | alpha.md | 🔨 Active | 🔴 P0 | First project |
| Beta | beta.md | 📋 Defined | 🟡 P1 | Second project |
| Gamma | gamma.md | ✅ Done | 🟢 P2 | Third project |

## Status Key
- 🔨 Active
`;

describe("parseIndex", () => {
  it("parses all data rows", () => {
    const rows = parseIndex(SAMPLE_INDEX);
    expect(rows).toHaveLength(3);
    expect(rows[0].name).toBe("Alpha");
    expect(rows[0].doc).toBe("alpha.md");
    expect(rows[0].statusEmoji).toBe("🔨");
    expect(rows[0].priorityEmoji).toBe("🔴");
  });

  it("sorts by status order (Active first, Done last)", () => {
    const rows = parseIndex(SAMPLE_INDEX);
    expect(rows[0].statusEmoji).toBe("🔨"); // Active
    expect(rows[1].statusEmoji).toBe("📋"); // Defined
    expect(rows[2].statusEmoji).toBe("✅"); // Done
  });

  it("skips header and separator rows", () => {
    const rows = parseIndex(SAMPLE_INDEX);
    expect(rows.every((r) => !r.name.includes("---"))).toBe(true);
    expect(rows.every((r) => r.name.toLowerCase() !== "project")).toBe(true);
  });

  it("returns empty array for empty content", () => {
    expect(parseIndex("")).toHaveLength(0);
    expect(parseIndex("# No table here")).toHaveLength(0);
  });
});

describe("updateRowStatus", () => {
  it("updates the correct row's status", () => {
    const { content, found } = updateRowStatus(SAMPLE_INDEX, "beta.md", "🔨 Active");
    expect(found).toBe(true);
    expect(content).toContain("🔨 Active");
    // Alpha should still be there
    expect(content).toContain("alpha.md");
    // Parse to verify
    const rows = parseIndex(content);
    const beta = rows.find((r) => r.doc === "beta.md");
    expect(beta?.statusEmoji).toBe("🔨");
  });

  it("returns found=false for non-existent doc", () => {
    const { found } = updateRowStatus(SAMPLE_INDEX, "nonexistent.md", "🔨 Active");
    expect(found).toBe(false);
  });
});

describe("removeRow", () => {
  it("removes the matching row", () => {
    const { content, found } = removeRow(SAMPLE_INDEX, "beta.md");
    expect(found).toBe(true);
    expect(content).not.toContain("beta.md");
    expect(content).toContain("alpha.md");
    expect(content).toContain("gamma.md");
  });

  it("returns found=false for non-existent doc", () => {
    const { found } = removeRow(SAMPLE_INDEX, "nonexistent.md");
    expect(found).toBe(false);
  });
});

describe("appendRow", () => {
  it("appends a new row to the table", () => {
    const result = appendRow(SAMPLE_INDEX, "Delta", "delta.md", "📋 Defined", "🟡 P1", "Fourth project");
    expect(result).toContain("| Delta | delta.md | 📋 Defined | 🟡 P1 | Fourth project |");
    // Should still have all original rows
    expect(result).toContain("alpha.md");
    expect(result).toContain("gamma.md");
  });

  it("inserts before Status Key section", () => {
    const result = appendRow(SAMPLE_INDEX, "Delta", "delta.md", "📋 Defined", "🟡 P1", "Fourth project");
    const lines = result.split("\n");
    const deltaIdx = lines.findIndex((l) => l.includes("delta.md"));
    const statusKeyIdx = lines.findIndex((l) => l.startsWith("## Status Key"));
    expect(deltaIdx).toBeLessThan(statusKeyIdx);
  });
});
