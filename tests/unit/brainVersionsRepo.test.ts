import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb } from "@/lib/database";
import type { StudioDb } from "@/lib/database";
import * as repo from "@/lib/database/repositories/brainVersionsRepo";
import type { BrainVersionFiles } from "@/lib/database/repositories/brainVersionsRepo";

// ─── Fixture ──────────────────────────────────────────────────────────────────

const sampleFiles: BrainVersionFiles = {
  "AGENTS.md": "# AGENTS.md\n\nOperating instructions.",
  "SOUL.md": "# SOUL.md\n\nPersonality.",
  "IDENTITY.md": "# IDENTITY.md\n\nName: Alex",
  "USER.md": "# USER.md\n\nMike.",
  "TOOLS.md": "# TOOLS.md\n\nTools.",
  "HEARTBEAT.md": "# HEARTBEAT.md\n\nHeartbeat.",
  "MEMORY.md": "# MEMORY.md\n\nMemory.",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("brainVersionsRepo", () => {
  let db: StudioDb;

  beforeEach(() => {
    db = createTestDb();
  });

  // ─── create + listByAgent ──────────────────────────────────────────────────

  describe("create + listByAgent", () => {
    it("creates a version and lists it", () => {
      repo.create(db, {
        id: "v1",
        agentId: "alex",
        label: "Initial version",
        description: "First snapshot",
        files: sampleFiles,
      });

      const versions = repo.listByAgent(db, "alex");
      expect(versions).toHaveLength(1);
      expect(versions[0].id).toBe("v1");
      expect(versions[0].versionNumber).toBe(1);
      expect(versions[0].label).toBe("Initial version");
      expect(versions[0].isActive).toBe(false);
    });

    it("auto-increments version numbers", () => {
      repo.create(db, { id: "v1", agentId: "alex", label: "v1", description: "", files: sampleFiles });
      repo.create(db, { id: "v2", agentId: "alex", label: "v2", description: "", files: sampleFiles });
      repo.create(db, { id: "v3", agentId: "alex", label: "v3", description: "", files: sampleFiles });

      const versions = repo.listByAgent(db, "alex");
      expect(versions).toHaveLength(3);
      // Newest first
      expect(versions[0].versionNumber).toBe(3);
      expect(versions[1].versionNumber).toBe(2);
      expect(versions[2].versionNumber).toBe(1);
    });

    it("version numbers are per-agent (not global)", () => {
      repo.create(db, { id: "a1", agentId: "alex", label: "", description: "", files: sampleFiles });
      repo.create(db, { id: "a2", agentId: "alex", label: "", description: "", files: sampleFiles });
      repo.create(db, { id: "b1", agentId: "bob", label: "", description: "", files: sampleFiles });

      const alexVersions = repo.listByAgent(db, "alex");
      const bobVersions = repo.listByAgent(db, "bob");

      expect(alexVersions[0].versionNumber).toBe(2);
      expect(bobVersions[0].versionNumber).toBe(1);
    });

    it("files are not included in list result", () => {
      repo.create(db, { id: "v1", agentId: "alex", label: "", description: "", files: sampleFiles });
      const versions = repo.listByAgent(db, "alex");
      expect("files" in versions[0]).toBe(false);
    });
  });

  // ─── getById ──────────────────────────────────────────────────────────────

  describe("getById", () => {
    it("retrieves a version with full file contents", () => {
      repo.create(db, {
        id: "v1",
        agentId: "alex",
        label: "My label",
        description: "My description",
        files: sampleFiles,
      });

      const version = repo.getById(db, "alex", "v1");
      expect(version).not.toBeNull();
      expect(version!.files["AGENTS.md"]).toBe(sampleFiles["AGENTS.md"]);
      expect(version!.files["SOUL.md"]).toBe(sampleFiles["SOUL.md"]);
    });

    it("returns null for unknown version", () => {
      expect(repo.getById(db, "alex", "nonexistent")).toBeNull();
    });

    it("returns null if agentId does not match", () => {
      repo.create(db, { id: "v1", agentId: "alex", label: "", description: "", files: sampleFiles });
      expect(repo.getById(db, "bob", "v1")).toBeNull();
    });
  });

  // ─── getActive ────────────────────────────────────────────────────────────

  describe("getActive", () => {
    it("returns null when no version is active", () => {
      repo.create(db, { id: "v1", agentId: "alex", label: "", description: "", files: sampleFiles });
      expect(repo.getActive(db, "alex")).toBeNull();
    });

    it("returns the active version after deploy", () => {
      repo.create(db, { id: "v1", agentId: "alex", label: "", description: "", files: sampleFiles });
      repo.deploy(db, "alex", "v1");
      const active = repo.getActive(db, "alex");
      expect(active).not.toBeNull();
      expect(active!.id).toBe("v1");
    });
  });

  // ─── deploy ───────────────────────────────────────────────────────────────

  describe("deploy", () => {
    it("marks the target version as active", () => {
      repo.create(db, { id: "v1", agentId: "alex", label: "", description: "", files: sampleFiles });
      const deployed = repo.deploy(db, "alex", "v1");
      expect(deployed).not.toBeNull();
      expect(deployed!.isActive).toBe(true);
      expect(deployed!.deployedAt).not.toBeNull();
    });

    it("clears the previously active version when a new one is deployed", () => {
      repo.create(db, { id: "v1", agentId: "alex", label: "", description: "", files: sampleFiles });
      repo.create(db, { id: "v2", agentId: "alex", label: "", description: "", files: sampleFiles });

      repo.deploy(db, "alex", "v1");
      repo.deploy(db, "alex", "v2");

      const v1 = repo.getById(db, "alex", "v1");
      const v2 = repo.getById(db, "alex", "v2");

      expect(v1!.isActive).toBe(false);
      expect(v2!.isActive).toBe(true);
    });

    it("returns the full version (with files) on deploy", () => {
      repo.create(db, { id: "v1", agentId: "alex", label: "", description: "", files: sampleFiles });
      const deployed = repo.deploy(db, "alex", "v1");
      expect(deployed!.files["SOUL.md"]).toBe(sampleFiles["SOUL.md"]);
    });

    it("returns null for unknown versionId", () => {
      expect(repo.deploy(db, "alex", "nonexistent")).toBeNull();
    });
  });

  // ─── update ───────────────────────────────────────────────────────────────

  describe("update", () => {
    it("updates label and description", () => {
      repo.create(db, { id: "v1", agentId: "alex", label: "old label", description: "old desc", files: sampleFiles });
      repo.update(db, "alex", "v1", { label: "new label", description: "new desc" });
      const version = repo.getById(db, "alex", "v1");
      expect(version!.label).toBe("new label");
      expect(version!.description).toBe("new desc");
    });

    it("returns false for unknown versionId", () => {
      const result = repo.update(db, "alex", "nonexistent", { label: "x" });
      expect(result).toBe(false);
    });
  });

  // ─── remove ───────────────────────────────────────────────────────────────

  describe("remove", () => {
    it("deletes a non-active version", () => {
      repo.create(db, { id: "v1", agentId: "alex", label: "", description: "", files: sampleFiles });
      const result = repo.remove(db, "alex", "v1");
      expect(result).toEqual({ deleted: true });
      expect(repo.getById(db, "alex", "v1")).toBeNull();
    });

    it("refuses to delete the active version", () => {
      repo.create(db, { id: "v1", agentId: "alex", label: "", description: "", files: sampleFiles });
      repo.deploy(db, "alex", "v1");
      const result = repo.remove(db, "alex", "v1");
      expect(result).toEqual({ deleted: false, reason: "active_version" });
      expect(repo.getById(db, "alex", "v1")).not.toBeNull();
    });

    it("returns not_found for unknown versionId", () => {
      const result = repo.remove(db, "alex", "nonexistent");
      expect(result).toEqual({ deleted: false, reason: "not_found" });
    });
  });

  // ─── nextVersionNumber ────────────────────────────────────────────────────

  describe("nextVersionNumber", () => {
    it("returns 1 for an agent with no versions", () => {
      expect(repo.nextVersionNumber(db, "new-agent")).toBe(1);
    });

    it("returns max + 1 for existing versions", () => {
      repo.create(db, { id: "v1", agentId: "alex", label: "", description: "", files: sampleFiles });
      repo.create(db, { id: "v2", agentId: "alex", label: "", description: "", files: sampleFiles });
      expect(repo.nextVersionNumber(db, "alex")).toBe(3);
    });
  });
});
