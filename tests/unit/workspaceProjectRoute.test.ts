import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioDb } from "@/lib/database";

let _testDb: StudioDb | null = null;

// Must be hoisted before route imports
vi.mock("@/lib/database", async () => {
  const actual = await vi.importActual<typeof import("@/lib/database")>("@/lib/database");
  return {
    ...actual,
    getDb: vi.fn(() => {
      if (!_testDb) _testDb = actual.createTestDb();
      return _testDb;
    }),
  };
});

vi.mock("@/lib/workspace/sidecar", () => ({
  isSidecarConfigured: vi.fn(() => false),
  sidecarGet: vi.fn(),
  sidecarMutate: vi.fn(),
  SidecarUnavailableError: class extends Error { name = "SidecarUnavailableError"; },
}));

vi.mock("@/lib/workspace/resolve", () => ({
  isSafeAgentId: vi.fn((id: string) => /^[a-zA-Z0-9_-]+$/.test(id)),
  readWorkspaceFile: vi.fn(),
  writeWorkspaceFile: vi.fn(),
  resolveWorkspacePath: vi.fn((agentId: string, relPath: string) => ({
    absolute: `/tmp/test/${agentId}/${relPath}`,
    relative: relPath,
  })),
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return { default: actual, ...actual, existsSync: vi.fn(() => false), mkdirSync: vi.fn(), renameSync: vi.fn() };
});

import { PATCH, DELETE } from "@/app/api/workspace/project/route";
import { readWorkspaceFile, writeWorkspaceFile } from "@/lib/workspace/resolve";
import * as projectsRepo from "@/lib/database/repositories/projectsRepo";
import { getDb } from "@/lib/database";

const mockedRead = vi.mocked(readWorkspaceFile);
const mockedWrite = vi.mocked(writeWorkspaceFile);

const INDEX_CONTENT = `| Project | Doc | Status | Priority | One-liner |
|---------|-----|--------|----------|-----------|
| My Project | my-project.md | 🔨 Active | 🟡 P1 | A test project |
| Other | other.md | ✅ Done | 🟢 P2 | Another |`;

function makeRequest(method: string, body: unknown): Request {
  return new Request("http://localhost/api/workspace/project", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const indexResult = { content: INDEX_CONTENT, size: INDEX_CONTENT.length, updatedAt: Date.now(), path: "projects/INDEX.md", isText: true } as const;
const writeResult = { path: "projects/INDEX.md", size: 0 } as const;

describe("PATCH /api/workspace/project", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _testDb = null; // Reset DB
    mockedRead.mockReturnValue({ ...indexResult });
    mockedWrite.mockReturnValue({ ...writeResult });
    // Seed DB with test data
    const db = getDb();
    projectsRepo.upsert(db, { name: "My Project", doc: "my-project.md", status: "🔨 Active", statusEmoji: "🔨", priority: "🟡 P1", priorityEmoji: "🟡", oneLiner: "A test project" }); projectsRepo.upsert(db, { name: "Other", doc: "other.md", status: "✅ Done", statusEmoji: "✅", priority: "🟢 P2", priorityEmoji: "🟢", oneLiner: "Another" });
  });

  it("rejects missing agentId", async () => {
    const res = await PATCH(makeRequest("PATCH", { doc: "x.md", status: "✅ Done" }));
    expect(res.status).toBe(400);
  });

  it("rejects unsafe agentId", async () => {
    const res = await PATCH(makeRequest("PATCH", { agentId: "../bad", doc: "x.md", status: "✅ Done" }));
    expect(res.status).toBe(400);
  });

  it("rejects missing status", async () => {
    const res = await PATCH(makeRequest("PATCH", { agentId: "agent-1", doc: "x.md" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown project doc", async () => {
    const res = await PATCH(makeRequest("PATCH", { agentId: "agent-1", doc: "nope.md", status: "✅ Done" }));
    expect(res.status).toBe(404);
  });

  it("updates project status", async () => {
    const res = await PATCH(makeRequest("PATCH", { agentId: "agent-1", doc: "my-project.md", status: "✅ Done" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.status).toBe("✅ Done");
    // DB-only mode: no INDEX.md write
    expect(mockedWrite).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/workspace/project", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _testDb = null; // Reset DB
    mockedRead.mockReturnValue({ ...indexResult });
    mockedWrite.mockReturnValue({ ...writeResult });
    // Seed DB with test data
    const db = getDb();
    projectsRepo.upsert(db, { name: "My Project", doc: "my-project.md", status: "🔨 Active", statusEmoji: "🔨", priority: "🟡 P1", priorityEmoji: "🟡", oneLiner: "A test project" }); projectsRepo.upsert(db, { name: "Other", doc: "other.md", status: "✅ Done", statusEmoji: "✅", priority: "🟢 P2", priorityEmoji: "🟢", oneLiner: "Another" });
  });

  it("rejects missing doc", async () => {
    const res = await DELETE(makeRequest("DELETE", { agentId: "agent-1" }));
    expect(res.status).toBe(400);
  });

  it("rejects path traversal in doc", async () => {
    const res = await DELETE(makeRequest("DELETE", { agentId: "agent-1", doc: "../evil.md" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown project", async () => {
    const res = await DELETE(makeRequest("DELETE", { agentId: "agent-1", doc: "nope.md" }));
    expect(res.status).toBe(404);
  });

  it("archives a project", async () => {
    const res = await DELETE(makeRequest("DELETE", { agentId: "agent-1", doc: "my-project.md" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.archived).toBe(true);
    // DB-only mode: no INDEX.md write
    expect(mockedWrite).not.toHaveBeenCalled();
  });
});
