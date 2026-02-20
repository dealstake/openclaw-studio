import { describe, it, expect } from "vitest";
import { classifyEntry, type WorkspaceEntry } from "@/features/workspace/types";

const entry = (overrides: Partial<WorkspaceEntry> & Pick<WorkspaceEntry, "name" | "path">): WorkspaceEntry => ({
  type: "file",
  ...overrides,
});

describe("classifyEntry", () => {
  describe("projects group", () => {
    it("classifies the projects directory itself", () => {
      expect(classifyEntry(entry({ name: "projects", path: "projects", type: "directory" }))).toBe("projects");
    });

    it("classifies files inside projects/", () => {
      expect(classifyEntry(entry({ name: "my-project.md", path: "projects/my-project.md" }))).toBe("projects");
    });

    it("classifies nested paths inside projects/", () => {
      expect(classifyEntry(entry({ name: "plan.md", path: "projects/sub/plan.md" }))).toBe("projects");
    });
  });

  describe("memory group", () => {
    it("classifies the memory directory itself", () => {
      expect(classifyEntry(entry({ name: "memory", path: "memory", type: "directory" }))).toBe("memory");
    });

    it("classifies files inside memory/", () => {
      expect(classifyEntry(entry({ name: "2026-02-20.md", path: "memory/2026-02-20.md" }))).toBe("memory");
    });
  });

  describe("brain group", () => {
    const brainFiles = ["AGENTS.md", "SOUL.md", "TOOLS.md", "IDENTITY.md", "USER.md", "HEARTBEAT.md", "BOOTSTRAP.md", "MEMORY.md"];

    for (const name of brainFiles) {
      it(`classifies ${name} as brain`, () => {
        expect(classifyEntry(entry({ name, path: name }))).toBe("brain");
      });
    }

    it("classifies brain files in non-projects/memory subdirectories as brain (name-based match)", () => {
      // classifyEntry checks entry.name, not full path — brain file names match anywhere
      // except under projects/ or memory/ (which take priority)
      expect(classifyEntry(entry({ name: "SOUL.md", path: "reference/SOUL.md" }))).toBe("brain");
    });

    it("does not classify directories with brain file names as brain", () => {
      expect(classifyEntry(entry({ name: "SOUL.md", path: "SOUL.md", type: "directory" }))).toBe("other");
    });
  });

  describe("other group", () => {
    it("classifies unknown root files as other", () => {
      expect(classifyEntry(entry({ name: "README.md", path: "README.md" }))).toBe("other");
    });

    it("classifies unknown directories as other", () => {
      expect(classifyEntry(entry({ name: "reference", path: "reference", type: "directory" }))).toBe("other");
    });

    it("classifies files in unknown subdirectories as other", () => {
      expect(classifyEntry(entry({ name: "notes.txt", path: "reference/notes.txt" }))).toBe("other");
    });
  });

  describe("priority: projects > memory > brain > other", () => {
    it("projects/ path wins over brain file name", () => {
      // A file named SOUL.md inside projects/ should be classified as projects
      expect(classifyEntry(entry({ name: "SOUL.md", path: "projects/SOUL.md" }))).toBe("projects");
    });

    it("memory/ path wins over brain file name", () => {
      expect(classifyEntry(entry({ name: "MEMORY.md", path: "memory/MEMORY.md" }))).toBe("memory");
    });
  });
});
