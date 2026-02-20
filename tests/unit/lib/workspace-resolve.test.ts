import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Mock resolveStateDir to use a temp directory
const tmpBase = path.join(os.tmpdir(), "workspace-resolve-test-" + process.pid);

vi.mock("@/lib/clawdbot/paths", () => ({
  resolveStateDir: () => tmpBase,
}));

// Import AFTER mock is set up
const {
  isSafeAgentId,
  isTextFile,
  resolveWorkspacePath,
  listWorkspaceDir,
  readWorkspaceFile,
  writeWorkspaceFile,
  isExcludedEntry,
} = await import("@/lib/workspace/resolve");

describe("isSafeAgentId", () => {
  it("accepts valid IDs", () => {
    expect(isSafeAgentId("alex")).toBe(true);
    expect(isSafeAgentId("agent-1")).toBe(true);
    expect(isSafeAgentId("my_agent_2")).toBe(true);
    expect(isSafeAgentId("A")).toBe(true);
  });

  it("rejects empty and whitespace", () => {
    expect(isSafeAgentId("")).toBe(false);
    expect(isSafeAgentId(" ")).toBe(false);
  });

  it("rejects IDs starting with special chars", () => {
    expect(isSafeAgentId("-agent")).toBe(false);
    expect(isSafeAgentId("_agent")).toBe(false);
    expect(isSafeAgentId(".agent")).toBe(false);
  });

  it("rejects IDs with path separators", () => {
    expect(isSafeAgentId("agent/evil")).toBe(false);
    expect(isSafeAgentId("agent\\evil")).toBe(false);
  });

  it("rejects IDs with dots", () => {
    expect(isSafeAgentId("agent.name")).toBe(false);
    expect(isSafeAgentId("..")).toBe(false);
  });
});

describe("isTextFile", () => {
  it("recognizes common text extensions", () => {
    expect(isTextFile("README.md")).toBe(true);
    expect(isTextFile("config.json")).toBe(true);
    expect(isTextFile("script.ts")).toBe(true);
    expect(isTextFile("style.css")).toBe(true);
    expect(isTextFile("data.yaml")).toBe(true);
  });

  it("recognizes files with no extension as text", () => {
    expect(isTextFile("Makefile")).toBe(true);
    expect(isTextFile("README")).toBe(true);
  });

  it("rejects binary extensions", () => {
    expect(isTextFile("image.png")).toBe(false);
    expect(isTextFile("archive.zip")).toBe(false);
    expect(isTextFile("binary.exe")).toBe(false);
  });
});

describe("isExcludedEntry", () => {
  it("excludes .git and node_modules", () => {
    expect(isExcludedEntry(".git")).toBe(true);
    expect(isExcludedEntry("node_modules")).toBe(true);
    expect(isExcludedEntry("sessions")).toBe(true);
    expect(isExcludedEntry("archive")).toBe(true);
    expect(isExcludedEntry(".DS_Store")).toBe(true);
  });

  it("excludes dotfiles", () => {
    expect(isExcludedEntry(".hidden")).toBe(true);
  });

  it("allows normal entries", () => {
    expect(isExcludedEntry("projects")).toBe(false);
    expect(isExcludedEntry("MEMORY.md")).toBe(false);
  });
});

describe("resolveWorkspacePath", () => {
  it("resolves valid relative paths", () => {
    const { absolute, workspace } = resolveWorkspacePath("alex", "projects/foo.md");
    expect(workspace).toBe(path.join(tmpBase, "agents", "alex"));
    expect(absolute).toBe(path.join(tmpBase, "agents", "alex", "projects", "foo.md"));
  });

  it("strips leading slashes", () => {
    const { absolute } = resolveWorkspacePath("alex", "/projects/foo.md");
    expect(absolute).toBe(path.join(tmpBase, "agents", "alex", "projects", "foo.md"));
  });

  it("rejects path traversal with ../", () => {
    expect(() => resolveWorkspacePath("alex", "../etc/passwd")).toThrow("Path traversal");
    expect(() => resolveWorkspacePath("alex", "projects/../../etc/passwd")).toThrow("Path traversal");
    expect(() => resolveWorkspacePath("alex", "..")).toThrow("Path traversal");
  });

  it("rejects backslash traversal", () => {
    // Backslashes are normalized to forward slashes, then checked
    expect(() => resolveWorkspacePath("alex", "..\\etc\\passwd")).toThrow("Path traversal");
  });

  it("rejects invalid agent IDs", () => {
    expect(() => resolveWorkspacePath("", "foo.md")).toThrow("Invalid agentId");
    expect(() => resolveWorkspacePath("../evil", "foo.md")).toThrow("Invalid agentId");
    expect(() => resolveWorkspacePath(" ", "foo.md")).toThrow("Invalid agentId");
  });

  it("allows empty relative path (workspace root)", () => {
    const { absolute, workspace } = resolveWorkspacePath("alex", "");
    expect(absolute).toBe(workspace);
  });
});

describe("listWorkspaceDir / readWorkspaceFile / writeWorkspaceFile", () => {
  const agentId = "test-agent";
  const agentDir = path.join(tmpBase, "agents", agentId);

  beforeEach(() => {
    fs.mkdirSync(agentDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  });

  it("lists empty directory", () => {
    const { entries } = listWorkspaceDir(agentId);
    expect(entries).toEqual([]);
  });

  it("lists files and directories sorted correctly", () => {
    fs.mkdirSync(path.join(agentDir, "projects"), { recursive: true });
    fs.writeFileSync(path.join(agentDir, "README.md"), "hello");
    fs.writeFileSync(path.join(agentDir, "MEMORY.md"), "memory");

    const { entries } = listWorkspaceDir(agentId);
    // Directories first, then files alphabetically
    expect(entries[0].name).toBe("projects");
    expect(entries[0].type).toBe("directory");
    expect(entries[1].name).toBe("MEMORY.md");
    expect(entries[1].type).toBe("file");
    expect(entries[2].name).toBe("README.md");
    expect(entries[2].type).toBe("file");
  });

  it("excludes .git and dotfiles", () => {
    fs.mkdirSync(path.join(agentDir, ".git"), { recursive: true });
    fs.writeFileSync(path.join(agentDir, ".hidden"), "secret");
    fs.writeFileSync(path.join(agentDir, "visible.md"), "ok");

    const { entries } = listWorkspaceDir(agentId);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("visible.md");
  });

  it("returns empty for non-existent path", () => {
    const { entries } = listWorkspaceDir(agentId, "nonexistent");
    expect(entries).toEqual([]);
  });

  it("throws for non-directory path", () => {
    fs.writeFileSync(path.join(agentDir, "file.txt"), "content");
    expect(() => listWorkspaceDir(agentId, "file.txt")).toThrow("not a directory");
  });

  it("writes and reads files", () => {
    const result = writeWorkspaceFile(agentId, "projects/test.md", "# Test");
    expect(result.path).toBe(path.join("projects", "test.md"));
    expect(result.size).toBeGreaterThan(0);

    const file = readWorkspaceFile(agentId, "projects/test.md");
    expect(file.content).toBe("# Test");
    expect(file.isText).toBe(true);
    expect(file.size).toBe(6);
  });

  it("creates parent directories on write", () => {
    writeWorkspaceFile(agentId, "deep/nested/dir/file.md", "content");
    expect(fs.existsSync(path.join(agentDir, "deep", "nested", "dir", "file.md"))).toBe(true);
  });

  it("throws when reading non-existent file", () => {
    expect(() => readWorkspaceFile(agentId, "nope.md")).toThrow("File not found");
  });

  it("throws when reading a directory as file", () => {
    fs.mkdirSync(path.join(agentDir, "adir"), { recursive: true });
    expect(() => readWorkspaceFile(agentId, "adir")).toThrow("not a file");
  });

  it("returns null content for binary files", () => {
    fs.writeFileSync(path.join(agentDir, "image.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const file = readWorkspaceFile(agentId, "image.png");
    expect(file.content).toBeNull();
    expect(file.isText).toBe(false);
  });
});
