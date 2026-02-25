import { beforeEach, afterEach, describe, expect, it } from "vitest";

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import {
  isSafeAgentId,
  resolveAgentWorkspace,
  resolveWorkspacePath,
  isTextFile,
  isExcludedEntry,
  listWorkspaceDir,
  readWorkspaceFile,
  writeWorkspaceFile,
} from "@/lib/workspace/resolve";

const ORIGINAL_ENV = { ...process.env };
let tempDir: string;

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-test-"));
  process.env.OPENCLAW_STATE_DIR = tempDir;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ── isSafeAgentId ──────────────────────────────────────────────────────────────

describe("isSafeAgentId", () => {
  it("accepts valid agent IDs", () => {
    expect(isSafeAgentId("alex")).toBe(true);
    expect(isSafeAgentId("main")).toBe(true);
    expect(isSafeAgentId("agent-1")).toBe(true);
    expect(isSafeAgentId("agent_2")).toBe(true);
    expect(isSafeAgentId("A1b2C3")).toBe(true);
  });

  it("rejects invalid agent IDs", () => {
    expect(isSafeAgentId("")).toBe(false);
    expect(isSafeAgentId("../evil")).toBe(false);
    expect(isSafeAgentId("-leading-dash")).toBe(false);
    expect(isSafeAgentId("_leading-underscore")).toBe(false);
    expect(isSafeAgentId("has spaces")).toBe(false);
    expect(isSafeAgentId("has/slash")).toBe(false);
    expect(isSafeAgentId("has.dot")).toBe(false);
  });
});

// ── resolveAgentWorkspace ──────────────────────────────────────────────────────

describe("resolveAgentWorkspace", () => {
  it("returns workspace path under state dir", () => {
    const result = resolveAgentWorkspace("alex");
    expect(result).toBe(path.join(tempDir, "agents", "alex"));
  });

  it("throws for empty agentId", () => {
    expect(() => resolveAgentWorkspace("")).toThrow("Invalid agentId");
  });

  it("throws for unsafe agentId", () => {
    expect(() => resolveAgentWorkspace("../bad")).toThrow("Invalid agentId");
  });
});

// ── resolveWorkspacePath ───────────────────────────────────────────────────────

describe("resolveWorkspacePath", () => {
  it("resolves a simple relative path", () => {
    const { absolute, workspace } = resolveWorkspacePath("alex", "projects/INDEX.md");
    expect(workspace).toBe(path.join(tempDir, "agents", "alex"));
    expect(absolute).toBe(path.join(tempDir, "agents", "alex", "projects", "INDEX.md"));
  });

  it("resolves root path (empty string)", () => {
    const { absolute, workspace } = resolveWorkspacePath("alex", "");
    expect(absolute).toBe(workspace);
  });

  it("rejects path traversal with ..", () => {
    expect(() => resolveWorkspacePath("alex", "../other-agent/secret")).toThrow(
      "traversal"
    );
  });

  it("rejects path traversal in the middle", () => {
    expect(() =>
      resolveWorkspacePath("alex", "projects/../../other/secret")
    ).toThrow("traversal");
  });

  it("strips leading slashes", () => {
    const { absolute } = resolveWorkspacePath("alex", "/projects/INDEX.md");
    expect(absolute).toBe(path.join(tempDir, "agents", "alex", "projects", "INDEX.md"));
  });
});

// ── isTextFile ─────────────────────────────────────────────────────────────────

describe("isTextFile", () => {
  it("recognizes markdown files", () => {
    expect(isTextFile("README.md")).toBe(true);
  });

  it("recognizes json files", () => {
    expect(isTextFile("config.json")).toBe(true);
  });

  it("recognizes files with no extension", () => {
    expect(isTextFile("Makefile")).toBe(true);
  });

  it("rejects binary files", () => {
    expect(isTextFile("image.png")).toBe(false);
    expect(isTextFile("archive.zip")).toBe(false);
    expect(isTextFile("data.sqlite")).toBe(false);
  });
});

// ── isExcludedEntry ────────────────────────────────────────────────────────────

describe("isExcludedEntry", () => {
  it("excludes .git", () => {
    expect(isExcludedEntry(".git")).toBe(true);
  });

  it("excludes node_modules", () => {
    expect(isExcludedEntry("node_modules")).toBe(true);
  });

  it("excludes sessions directory", () => {
    expect(isExcludedEntry("sessions")).toBe(true);
  });

  it("excludes dotfiles", () => {
    expect(isExcludedEntry(".DS_Store")).toBe(true);
    expect(isExcludedEntry(".hidden")).toBe(true);
  });

  it("does not exclude normal directories", () => {
    expect(isExcludedEntry("projects")).toBe(false);
    expect(isExcludedEntry("memory")).toBe(false);
    expect(isExcludedEntry("drafts")).toBe(false);
  });
});

// ── listWorkspaceDir ───────────────────────────────────────────────────────────

describe("listWorkspaceDir", () => {
  it("returns empty entries for non-existent workspace", () => {
    const { entries } = listWorkspaceDir("nonexistent");
    expect(entries).toEqual([]);
  });

  it("lists files and directories in workspace root", () => {
    const agentDir = path.join(tempDir, "agents", "test1");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, "AGENTS.md"), "# Test");
    fs.writeFileSync(path.join(agentDir, "SOUL.md"), "# Soul");
    fs.mkdirSync(path.join(agentDir, "projects"));
    fs.mkdirSync(path.join(agentDir, "memory"));

    const { entries } = listWorkspaceDir("test1");

    expect(entries.length).toBe(4);

    // Directories come first
    const dirs = entries.filter((e) => e.type === "directory");
    const files = entries.filter((e) => e.type === "file");
    expect(dirs.length).toBe(2);
    expect(files.length).toBe(2);
    expect(dirs[0].name).toBe("memory");
    expect(dirs[1].name).toBe("projects");
  });

  it("excludes .git and sessions directories", () => {
    const agentDir = path.join(tempDir, "agents", "test2");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.mkdirSync(path.join(agentDir, ".git"));
    fs.mkdirSync(path.join(agentDir, "sessions"));
    fs.mkdirSync(path.join(agentDir, "projects"));
    fs.writeFileSync(path.join(agentDir, "AGENTS.md"), "# Test");

    const { entries } = listWorkspaceDir("test2");
    const names = entries.map((e) => e.name);

    expect(names).not.toContain(".git");
    expect(names).not.toContain("sessions");
    expect(names).toContain("projects");
    expect(names).toContain("AGENTS.md");
  });

  it("lists contents of a subdirectory", () => {
    const agentDir = path.join(tempDir, "agents", "test3");
    const projDir = path.join(agentDir, "projects");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, "INDEX.md"), "# Index");
    fs.writeFileSync(path.join(projDir, "feature-a.md"), "# Feature A");

    const { entries } = listWorkspaceDir("test3", "projects");

    expect(entries.length).toBe(2);
    expect(entries.every((e) => e.type === "file")).toBe(true);
    expect(entries.map((e) => e.name)).toContain("INDEX.md");
    expect(entries.map((e) => e.name)).toContain("feature-a.md");
  });

  it("includes size and updatedAt for files", () => {
    const agentDir = path.join(tempDir, "agents", "test4");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, "test.md"), "hello world");

    const { entries } = listWorkspaceDir("test4");
    const file = entries.find((e) => e.name === "test.md");

    expect(file).toBeDefined();
    expect(file!.size).toBe(11);
    expect(file!.updatedAt).toBeGreaterThan(0);
  });
});

// ── readWorkspaceFile ──────────────────────────────────────────────────────────

describe("readWorkspaceFile", () => {
  it("reads a text file and returns content", () => {
    const agentDir = path.join(tempDir, "agents", "test5");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, "README.md"), "# Hello World");

    const result = readWorkspaceFile("test5", "README.md");

    expect(result.content).toBe("# Hello World");
    expect(result.isText).toBe(true);
    expect(result.size).toBe(13);
    expect(result.updatedAt).toBeGreaterThan(0);
    expect(result.path).toBe("README.md");
  });

  it("reads a file in a subdirectory", () => {
    const agentDir = path.join(tempDir, "agents", "test6");
    const projDir = path.join(agentDir, "projects");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, "plan.md"), "## Plan");

    const result = readWorkspaceFile("test6", "projects/plan.md");

    expect(result.content).toBe("## Plan");
    expect(result.path).toBe(path.join("projects", "plan.md"));
  });

  it("returns null content for non-text files", () => {
    const agentDir = path.join(tempDir, "agents", "test7");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, "image.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const result = readWorkspaceFile("test7", "image.png");

    expect(result.content).toBeNull();
    expect(result.isText).toBe(false);
    expect(result.size).toBe(4);
  });

  it("throws for non-existent file", () => {
    const agentDir = path.join(tempDir, "agents", "test8");
    fs.mkdirSync(agentDir, { recursive: true });

    expect(() => readWorkspaceFile("test8", "missing.md")).toThrow("not found");
  });

  it("throws for directory path", () => {
    const agentDir = path.join(tempDir, "agents", "test9");
    fs.mkdirSync(path.join(agentDir, "projects"), { recursive: true });

    expect(() => readWorkspaceFile("test9", "projects")).toThrow("not a file");
  });

  it("rejects path traversal", () => {
    expect(() => readWorkspaceFile("test", "../other/secret")).toThrow("traversal");
  });
});

// ── writeWorkspaceFile ─────────────────────────────────────────────────────────

describe("writeWorkspaceFile", () => {
  it("writes a new file", () => {
    const agentDir = path.join(tempDir, "agents", "test10");
    fs.mkdirSync(agentDir, { recursive: true });

    const result = writeWorkspaceFile("test10", "notes.md", "# Notes");

    expect(result.path).toBe("notes.md");
    expect(result.size).toBe(7);

    const content = fs.readFileSync(path.join(agentDir, "notes.md"), "utf-8");
    expect(content).toBe("# Notes");
  });

  it("creates parent directories if needed", () => {
    const agentDir = path.join(tempDir, "agents", "test11");
    fs.mkdirSync(agentDir, { recursive: true });

    const result = writeWorkspaceFile("test11", "projects/new-project.md", "# New");

    expect(result.path).toBe(path.join("projects", "new-project.md"));
    expect(fs.existsSync(path.join(agentDir, "projects", "new-project.md"))).toBe(true);
  });

  it("overwrites existing file", () => {
    const agentDir = path.join(tempDir, "agents", "test12");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, "test.md"), "old content");

    writeWorkspaceFile("test12", "test.md", "new content");

    const content = fs.readFileSync(path.join(agentDir, "test.md"), "utf-8");
    expect(content).toBe("new content");
  });

  it("rejects path traversal", () => {
    expect(() =>
      writeWorkspaceFile("test", "../escape.md", "malicious")
    ).toThrow("traversal");
  });
});
