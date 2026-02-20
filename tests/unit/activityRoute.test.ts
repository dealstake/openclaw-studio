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

  it("auto-imports from JSONL when DB empty", async () => {
    mockQuery
      .mockReturnValueOnce({ events: [], total: 0 })  // first query: empty
      .mockReturnValueOnce({ events: [{ id: "imported" }], total: 1 }); // after import
    mockFsPromises.readFile.mockResolvedValue('{"id":"1","timestamp":"2026-01-01","status":"success"}\n');

    const res = await GET(makeGetRequest({ agentId: "alex" }));
    expect(res.status).toBe(200);
    expect(mockImportFromJsonl).toHaveBeenCalled();
    // Second query should be called after import
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("skips auto-import when filters are active", async () => {
    mockQuery.mockReturnValue({ events: [], total: 0 });
    const res = await GET(makeGetRequest({ agentId: "alex", type: "cron-completion" }));
    expect(res.status).toBe(200);
    expect(mockFsPromises.readFile).not.toHaveBeenCalled();
    expect(mockImportFromJsonl).not.toHaveBeenCalled();
  });

  it("handles sidecar fallback path", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    const jsonl = '{"type":"cron","status":"success","timestamp":"2026-01-02"}\n{"type":"cron","status":"error","timestamp":"2026-01-01"}\n';
    mockSidecarGet.mockResolvedValue({
      ok: true,
      json: async () => ({ content: jsonl }),
    });

    const res = await GET(makeGetRequest({ agentId: "alex" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(2);
    expect(data.events).toHaveLength(2);
    // Should be sorted newest first
    expect(data.events[0].timestamp).toBe("2026-01-02");
  });

  it("sidecar returns empty when file not found", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    mockSidecarGet.mockResolvedValue({ ok: false });

    const res = await GET(makeGetRequest({ agentId: "alex" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(0);
  });

  it("sidecar applies type filter", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    const jsonl = '{"type":"cron","status":"success","timestamp":"2026-01-01"}\n{"type":"alert","status":"error","timestamp":"2026-01-02"}\n';
    mockSidecarGet.mockResolvedValue({
      ok: true,
      json: async () => ({ content: jsonl }),
    });

    const res = await GET(makeGetRequest({ agentId: "alex", type: "alert" }));
    const data = await res.json();
    expect(data.total).toBe(1);
    expect(data.events[0].type).toBe("alert");
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

  it("skips DB insert when sidecar is configured", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    const body = { id: "evt-2", timestamp: "2026-01-01", status: "error" };
    const res = await POST(makePostRequest(body, { agentId: "alex" }));
    expect(res.status).toBe(200);
    expect(mockInsert).not.toHaveBeenCalled();
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
