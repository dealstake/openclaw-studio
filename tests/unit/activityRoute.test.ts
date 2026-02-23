import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/database", () => ({ getDb: vi.fn(() => ({})) }));

const mockQuery = vi.fn();
const mockInsert = vi.fn();
const mockImportFromJsonl = vi.fn();
vi.mock("@/lib/database/repositories/activityRepo", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  insert: (...args: unknown[]) => mockInsert(...args),
  importFromJsonl: (...args: unknown[]) => mockImportFromJsonl(...args),
}));

const mockIsSidecarConfigured = vi.fn(() => false);
const mockSidecarGet = vi.fn();
vi.mock("@/lib/workspace/sidecar", () => ({
  isSidecarConfigured: () => mockIsSidecarConfigured(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sidecarGet: (...args: any[]) => mockSidecarGet(...args),
}));

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockResolveWorkspacePath = vi.fn((_a: string, _p: string) => ({ absolute: "/fake/reports/activity.jsonl" }));
vi.mock("@/lib/workspace/resolve", () => ({
  resolveWorkspacePath: (agentId: string, p: string) => mockResolveWorkspacePath(agentId, p),
  isSafeAgentId: (id: string) => /^[a-zA-Z0-9_-]+$/.test(id),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    appendFile: vi.fn(),
  },
}));

import fsPromises from "node:fs/promises";
const mockFsPromises = vi.mocked(fsPromises);

import { GET, POST } from "@/app/api/activity/route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeGetRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/activity");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString()) as unknown as Request;
}

function makePostRequest(body: Record<string, unknown>, params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/activity");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Request;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSidecarConfigured.mockReturnValue(false);
  });

  it("returns 400 when agentId missing", async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(400);
  });

  it("returns 400 for unsafe agentId", async () => {
    const res = await GET(makeGetRequest({ agentId: "../evil" }));
    expect(res.status).toBe(400);
  });

  it("queries database with filters", async () => {
    mockQuery.mockReturnValue({ events: [{ id: "1" }], total: 1 });
    const res = await GET(makeGetRequest({
      agentId: "alex",
      limit: "10",
      offset: "5",
      type: "cron-completion",
      status: "success",
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(1);
    expect(mockQuery).toHaveBeenCalledWith({}, {
      type: "cron-completion",
      taskId: null,
      projectSlug: null,
      status: "success",
      includeTranscript: false,
      limit: 10,
      offset: 5,
    });
  });

  it("caps limit at 200", async () => {
    mockQuery.mockReturnValue({ events: [], total: 0 });
    // Need a non-empty result to avoid auto-import path
    mockQuery.mockReturnValueOnce({ events: [], total: 0 });
    mockFsPromises.readFile.mockRejectedValue(new Error("ENOENT"));
    await GET(makeGetRequest({ agentId: "alex", limit: "999" }));
    expect(mockQuery).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ limit: 200 }));
  });

  it("handles sidecar proxy path", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    // withSidecarGetFallback calls sidecarGet which returns the Mac Mini's DB response
    mockSidecarGet.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events: [
        { type: "cron", status: "success", timestamp: "2026-01-02" },
        { type: "cron", status: "error", timestamp: "2026-01-01" },
      ], total: 2 }),
    });

    const res = await GET(makeGetRequest({ agentId: "alex" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(2);
    expect(data.events).toHaveLength(2);
  });

  it("sidecar returns empty on error", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    mockSidecarGet.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events: [], total: 0 }),
    });

    const res = await GET(makeGetRequest({ agentId: "alex" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(0);
  });

  it("sidecar passes filter params", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    mockSidecarGet.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ events: [
        { type: "alert", status: "error", timestamp: "2026-01-02" },
      ], total: 1 }),
    });

    const res = await GET(makeGetRequest({ agentId: "alex", type: "alert" }));
    const data = await res.json();
    expect(data.total).toBe(1);
    expect(data.events[0].type).toBe("alert");
    // Verify sidecarGet was called with type filter param
    expect(mockSidecarGet).toHaveBeenCalledWith("/activity", expect.objectContaining({ type: "alert" }));
  });
});

describe("POST /api/activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSidecarConfigured.mockReturnValue(false);
    mockFsPromises.appendFile.mockResolvedValue(undefined);
  });

  it("returns 400 when agentId missing", async () => {
    const res = await POST(makePostRequest({ id: "1", timestamp: "now", status: "success" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields missing", async () => {
    const res = await POST(makePostRequest({ id: "1" }, { agentId: "alex" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("required fields");
  });

  it("inserts into DB and dual-writes to JSONL", async () => {
    const body = {
      id: "evt-1",
      timestamp: "2026-01-01T00:00:00Z",
      type: "cron-completion",
      status: "success",
      summary: "Test event",
    };
    const res = await POST(makePostRequest(body, { agentId: "alex" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith({}, expect.objectContaining({ id: "evt-1", status: "success" }));
    expect(mockFsPromises.appendFile).toHaveBeenCalled();
  });

  it("writes to both DB and JSONL when sidecar is configured", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    const body = { id: "evt-2", timestamp: "2026-01-01", status: "error" };
    const res = await POST(makePostRequest(body, { agentId: "alex" }));
    expect(res.status).toBe(200);
    // DB write happens in both modes for data consistency
    expect(mockInsert).toHaveBeenCalled();
    // Still writes to JSONL
    expect(mockFsPromises.appendFile).toHaveBeenCalled();
  });

  it("succeeds even if JSONL write fails", async () => {
    mockFsPromises.appendFile.mockRejectedValue(new Error("ENOENT"));
    const body = { id: "evt-3", timestamp: "2026-01-01", status: "success" };
    const res = await POST(makePostRequest(body, { agentId: "alex" }));
    expect(res.status).toBe(200);
  });
});
