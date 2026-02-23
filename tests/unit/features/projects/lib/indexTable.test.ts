import { describe, it, expect } from "vitest";
import { parseIndex } from "@/features/projects/lib/indexTable";

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
