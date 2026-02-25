import { beforeEach, afterEach, describe, expect, it } from "vitest";

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

import { GET as filesGET } from "@/app/api/workspace/files/route";
import { GET as fileGET, PUT as filePUT } from "@/app/api/workspace/file/route";

const ORIGINAL_ENV = { ...process.env };
let tempDir: string;

const makeRequest = (url: string, init?: RequestInit) =>
  new Request(`http://localhost:3000${url}`, init);

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "workspace-api-test-"));
  process.env.OPENCLAW_STATE_DIR = tempDir;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  fs.rmSync(tempDir, { recursive: true, force: true });
});

// ── GET /api/workspace/files ───────────────────────────────────────────────────

describe("GET /api/workspace/files", () => {
  it("returns 400 when agentId is missing", async () => {
    const response = await filesGET(makeRequest("/api/workspace/files"));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/agentId/);
  });

  it("returns 400 for invalid agentId", async () => {
    const response = await filesGET(
      makeRequest("/api/workspace/files?agentId=../evil")
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/Invalid agentId/);
  });

  it("returns empty entries for non-existent workspace", async () => {
    const response = await filesGET(
      makeRequest("/api/workspace/files?agentId=nonexistent")
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.entries).toEqual([]);
    expect(body.count).toBe(0);
  });

  it("lists workspace root entries", async () => {
    const agentDir = path.join(tempDir, "agents", "alex");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, "AGENTS.md"), "# Test");
    fs.mkdirSync(path.join(agentDir, "projects"));

    const response = await filesGET(
      makeRequest("/api/workspace/files?agentId=alex")
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.agentId).toBe("alex");
    expect(body.count).toBe(2);

    const names = body.entries.map((e: { name: string }) => e.name);
    expect(names).toContain("projects");
    expect(names).toContain("AGENTS.md");
  });

  it("lists subdirectory entries with path param", async () => {
    const projDir = path.join(tempDir, "agents", "alex", "projects");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, "INDEX.md"), "# Index");
    fs.writeFileSync(path.join(projDir, "feature.md"), "# Feature");

    const response = await filesGET(
      makeRequest("/api/workspace/files?agentId=alex&path=projects")
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.count).toBe(2);
    expect(body.path).toBe("projects");
  });

  it("rejects path traversal", async () => {
    const response = await filesGET(
      makeRequest("/api/workspace/files?agentId=alex&path=../other")
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toMatch(/traversal/);
  });
});

// ── GET /api/workspace/file ────────────────────────────────────────────────────

describe("GET /api/workspace/file", () => {
  it("returns 400 when agentId is missing", async () => {
    const response = await fileGET(
      makeRequest("/api/workspace/file?path=test.md")
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 when path is missing", async () => {
    const response = await fileGET(
      makeRequest("/api/workspace/file?agentId=alex")
    );
    expect(response.status).toBe(400);
  });

  it("returns 404 for non-existent file", async () => {
    const agentDir = path.join(tempDir, "agents", "alex");
    fs.mkdirSync(agentDir, { recursive: true });

    const response = await fileGET(
      makeRequest("/api/workspace/file?agentId=alex&path=missing.md")
    );
    expect(response.status).toBe(404);
  });

  it("reads a text file and returns content", async () => {
    const agentDir = path.join(tempDir, "agents", "alex");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(path.join(agentDir, "README.md"), "# Hello");

    const response = await fileGET(
      makeRequest("/api/workspace/file?agentId=alex&path=README.md")
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.content).toBe("# Hello");
    expect(body.isText).toBe(true);
    expect(body.size).toBe(7);
    expect(body.agentId).toBe("alex");
  });

  it("reads a file in a subdirectory", async () => {
    const projDir = path.join(tempDir, "agents", "alex", "projects");
    fs.mkdirSync(projDir, { recursive: true });
    fs.writeFileSync(path.join(projDir, "plan.md"), "## Plan");

    const response = await fileGET(
      makeRequest("/api/workspace/file?agentId=alex&path=projects/plan.md")
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.content).toBe("## Plan");
  });

  it("returns null content for binary files", async () => {
    const agentDir = path.join(tempDir, "agents", "alex");
    fs.mkdirSync(agentDir, { recursive: true });
    fs.writeFileSync(
      path.join(agentDir, "image.png"),
      Buffer.from([0x89, 0x50, 0x4e, 0x47])
    );

    const response = await fileGET(
      makeRequest("/api/workspace/file?agentId=alex&path=image.png")
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.content).toBeNull();
    expect(body.isText).toBe(false);
  });

  it("rejects path traversal", async () => {
    const response = await fileGET(
      makeRequest("/api/workspace/file?agentId=alex&path=../secret")
    );
    expect(response.status).toBe(403);
  });
});

// ── PUT /api/workspace/file ────────────────────────────────────────────────────

describe("PUT /api/workspace/file", () => {
  it("returns 400 for missing agentId", async () => {
    const response = await filePUT(
      makeRequest("/api/workspace/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: "test.md", content: "hello" }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for missing path", async () => {
    const response = await filePUT(
      makeRequest("/api/workspace/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "alex", content: "hello" }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for missing content", async () => {
    const response = await filePUT(
      makeRequest("/api/workspace/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: "alex", path: "test.md" }),
      })
    );
    expect(response.status).toBe(400);
  });

  it("returns 400 for non-text file extension", async () => {
    const response = await filePUT(
      makeRequest("/api/workspace/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "alex",
          path: "image.png",
          content: "fake",
        }),
      })
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/text files/i);
  });

  it("writes a new file successfully", async () => {
    const agentDir = path.join(tempDir, "agents", "alex");
    fs.mkdirSync(agentDir, { recursive: true });

    const response = await filePUT(
      makeRequest("/api/workspace/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "alex",
          path: "notes.md",
          content: "# My Notes",
        }),
      })
    );
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.path).toBe("notes.md");

    const content = fs.readFileSync(
      path.join(agentDir, "notes.md"),
      "utf-8"
    );
    expect(content).toBe("# My Notes");
  });

  it("creates parent directories when writing", async () => {
    const agentDir = path.join(tempDir, "agents", "alex");
    fs.mkdirSync(agentDir, { recursive: true });

    const response = await filePUT(
      makeRequest("/api/workspace/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "alex",
          path: "projects/new.md",
          content: "# New Project",
        }),
      })
    );
    expect(response.status).toBe(200);

    const filePath = path.join(agentDir, "projects", "new.md");
    expect(fs.existsSync(filePath)).toBe(true);
    expect(fs.readFileSync(filePath, "utf-8")).toBe("# New Project");
  });

  it("rejects path traversal", async () => {
    const response = await filePUT(
      makeRequest("/api/workspace/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "alex",
          path: "../escape.md",
          content: "malicious",
        }),
      })
    );
    expect(response.status).toBe(403);
  });

  it("rejects invalid agentId", async () => {
    const response = await filePUT(
      makeRequest("/api/workspace/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: "../evil",
          path: "test.md",
          content: "data",
        }),
      })
    );
    expect(response.status).toBe(400);
  });
});
