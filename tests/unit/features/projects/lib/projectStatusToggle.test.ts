import { describe, it, expect } from "vitest";

/**
 * Tests for project status toggle logic (INDEX.md table row replacement).
 * This mirrors the logic in /api/workspace/project PATCH route.
 */

function updateProjectStatus(content: string, doc: string, newStatus: string): string | null {
  const lines = content.split("\n");
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(
      /^(\|\s*.+?\s*\|\s*)(.+?)(\s*\|\s*)(.+?)(\s*\|\s*.+?\s*\|\s*.+?\s*\|)$/
    );
    if (!match) continue;

    const docCell = match[2].trim();
    if (docCell !== doc) continue;

    lines[i] = `${match[1]}${match[2]}${match[3]}${newStatus}${match[5]}`;
    found = true;
    break;
  }

  return found ? lines.join("\n") : null;
}

// Toggle map matching the UI
const TOGGLE_MAP: Record<string, { emoji: string; label: string }> = {
  "🔨": { emoji: "⏸️", label: "Parked" },
  "📋": { emoji: "🔨", label: "Active" },
  "⏸️": { emoji: "🔨", label: "Active" },
  "🌊": { emoji: "📋", label: "Defined" },
};

const SAMPLE_INDEX = `# Projects Index

| Project | Doc | Status | Priority | One-liner |
|---------|-----|--------|----------|-----------|
| Alpha | alpha.md | 🔨 Active | 🔴 P0 | Active project |
| Beta | beta.md | ⏸️ Parked | 🟡 P1 | Parked project |
| Gamma | gamma.md | ✅ Done | — | Done project |
| Delta | delta.md | 📋 Defined | 🟢 P2 | Defined project |
| Echo | echo.md | 🌊 Stream | 🟡 P1 | Stream project |
`;

describe("Project status toggle", () => {
  it("toggles Active → Parked", () => {
    const toggle = TOGGLE_MAP["🔨"];
    const result = updateProjectStatus(SAMPLE_INDEX, "alpha.md", `${toggle.emoji} ${toggle.label}`);
    expect(result).toContain("| alpha.md | ⏸️ Parked |");
    expect(result).not.toContain("🔨 Active");
  });

  it("toggles Parked → Active", () => {
    const toggle = TOGGLE_MAP["⏸️"];
    const result = updateProjectStatus(SAMPLE_INDEX, "beta.md", `${toggle.emoji} ${toggle.label}`);
    expect(result).toContain("| beta.md | 🔨 Active |");
    expect(result).not.toContain("⏸️ Parked");
  });

  it("toggles Defined → Active", () => {
    const toggle = TOGGLE_MAP["📋"];
    const result = updateProjectStatus(SAMPLE_INDEX, "delta.md", `${toggle.emoji} ${toggle.label}`);
    expect(result).toContain("| delta.md | 🔨 Active |");
  });

  it("toggles Stream → Defined", () => {
    const toggle = TOGGLE_MAP["🌊"];
    const result = updateProjectStatus(SAMPLE_INDEX, "echo.md", `${toggle.emoji} ${toggle.label}`);
    expect(result).toContain("| echo.md | 📋 Defined |");
  });

  it("returns null for non-existent project", () => {
    const result = updateProjectStatus(SAMPLE_INDEX, "nonexistent.md", "🔨 Active");
    expect(result).toBeNull();
  });

  it("does not modify other rows", () => {
    const toggle = TOGGLE_MAP["🔨"];
    const result = updateProjectStatus(SAMPLE_INDEX, "alpha.md", `${toggle.emoji} ${toggle.label}`);
    expect(result).toContain("| gamma.md | ✅ Done |");
    expect(result).toContain("| beta.md | ⏸️ Parked |");
  });

  it("preserves header and separator lines", () => {
    const toggle = TOGGLE_MAP["🔨"];
    const result = updateProjectStatus(SAMPLE_INDEX, "alpha.md", `${toggle.emoji} ${toggle.label}`)!;
    expect(result).toContain("# Projects Index");
    expect(result).toContain("|---------|-----|--------|----------|-----------|");
  });

  it("Done projects have no toggle mapping", () => {
    const toggle = TOGGLE_MAP["✅"];
    expect(toggle).toBeUndefined();
  });
});
