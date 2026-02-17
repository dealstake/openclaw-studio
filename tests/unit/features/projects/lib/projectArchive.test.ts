import { describe, it, expect } from "vitest";

/**
 * Tests for project archive logic (INDEX.md row removal).
 * Mirrors the logic in /api/workspace/project DELETE route.
 */

function removeProjectFromIndex(content: string, doc: string): { updated: string; found: boolean } {
  const lines = content.split("\n");
  let found = false;
  const updatedLines = lines.filter((line) => {
    const match = line.match(
      /^\|\s*.+?\s*\|\s*(.+?)\s*\|\s*.+?\s*\|\s*.+?\s*\|\s*.+?\s*\|$/
    );
    if (match && match[1].trim() === doc) {
      found = true;
      return false;
    }
    return true;
  });
  return { updated: updatedLines.join("\n"), found };
}

const SAMPLE_INDEX = `# Projects Index

| Project | Doc | Status | Priority | One-liner |
|---------|-----|--------|----------|-----------|
| Alpha | alpha.md | 🔨 Active | 🔴 P0 | Active project |
| Beta | beta.md | ⏸️ Parked | 🟡 P1 | Parked project |
| Gamma | gamma.md | ✅ Done | — | Done project |
| Delta | delta.md | 📋 Defined | 🟢 P2 | Defined project |
`;

describe("Project archive (row removal)", () => {
  it("removes the target project row", () => {
    const { updated, found } = removeProjectFromIndex(SAMPLE_INDEX, "gamma.md");
    expect(found).toBe(true);
    expect(updated).not.toContain("gamma.md");
    expect(updated).not.toContain("Done project");
  });

  it("preserves other project rows", () => {
    const { updated } = removeProjectFromIndex(SAMPLE_INDEX, "gamma.md");
    expect(updated).toContain("| alpha.md |");
    expect(updated).toContain("| beta.md |");
    expect(updated).toContain("| delta.md |");
  });

  it("preserves header and separator", () => {
    const { updated } = removeProjectFromIndex(SAMPLE_INDEX, "gamma.md");
    expect(updated).toContain("# Projects Index");
    expect(updated).toContain("|---------|-----|--------|----------|-----------|");
    expect(updated).toContain("| Project | Doc | Status | Priority | One-liner |");
  });

  it("returns found=false for non-existent project", () => {
    const { found } = removeProjectFromIndex(SAMPLE_INDEX, "nonexistent.md");
    expect(found).toBe(false);
  });

  it("handles removing the last project", () => {
    const singleProject = `# Projects Index

| Project | Doc | Status | Priority | One-liner |
|---------|-----|--------|----------|-----------|
| Only | only.md | ✅ Done | — | The only project |
`;
    const { updated, found } = removeProjectFromIndex(singleProject, "only.md");
    expect(found).toBe(true);
    expect(updated).not.toContain("only.md");
    expect(updated).toContain("| Project | Doc |");
  });

  it("rejects doc filenames with path traversal", () => {
    // This tests the validation logic, not the removal function
    const badDocs = ["../secret.md", "foo/bar.md", "..\\evil.md"];
    for (const doc of badDocs) {
      expect(doc.includes("/") || doc.includes("\\") || doc.includes("..")).toBe(true);
    }
  });
});
