import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";
import { Readable } from "node:stream";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  const mocks = {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    createReadStream: vi.fn(),
  };
  return { ...mocks, default: mocks };
});

const mockedFs = vi.mocked(fs);

const mockIsSidecarConfigured = vi.fn(() => false);
const mockSidecarGet = vi.fn();
vi.mock("@/lib/workspace/sidecar", () => ({
  isSidecarConfigured: () => mockIsSidecarConfigured(),
  sidecarGet: (...args: unknown[]) => mockSidecarGet(...args),
}));

vi.mock("@/lib/workspace/resolve", () => ({
  resolveAgentWorkspace: (agentId: string) => `/fake/agents/${agentId}`,
  isSafeAgentId: (id: string) => /^[a-zA-Z0-9_-]+$/.test(id),
}));

import { GET } from "@/app/api/sessions/trace/route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/sessions/trace");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString()) as unknown as Request;
}

function makeJsonlStream(lines: string[]): fs.ReadStream {
  const readable = new Readable({ read() {} });
  for (const line of lines) readable.push(line + "\n");
  readable.push(null);
  return readable as unknown as fs.ReadStream;
}

const UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

function msgLine(role: string, content: string, index: number) {
  return JSON.stringify({
    type: "message",
    id: `msg-${index}`,
    message: { role, content, timestamp: `2026-01-01T00:0${index}:00Z` },
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/sessions/trace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSidecarConfigured.mockReturnValue(false);
  });

  it("returns 400 when agentId missing", async () => {
    const res = await GET(makeRequest({ sessionId: UUID }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when sessionId missing", async () => {
    const res = await GET(makeRequest({ agentId: "alex" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("sessionId");
  });

  it("reads local JSONL and returns paginated messages", async () => {
    const lines = [
      msgLine("user", "Hello", 0),
      msgLine("assistant", "Hi there", 1),
      msgLine("user", "How are you", 2),
    ];

    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.createReadStream.mockReturnValue(makeJsonlStream(lines));

    const res = await GET(makeRequest({ agentId: "alex", sessionId: UUID, limit: "2" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(3);
    expect(data.messages).toHaveLength(2);
    expect(data.hasMore).toBe(true);
    expect(data.messages[0].role).toBe("user");
    expect(data.messages[1].role).toBe("assistant");
  });

  it("supports offset pagination", async () => {
    const lines = [
      msgLine("user", "Hello", 0),
      msgLine("assistant", "Hi", 1),
      msgLine("user", "Bye", 2),
    ];

    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.createReadStream.mockReturnValue(makeJsonlStream(lines));

    const res = await GET(makeRequest({ agentId: "alex", sessionId: UUID, offset: "1", limit: "1" }));
    const data = await res.json();
    expect(data.messages).toHaveLength(1);
    expect(data.messages[0].content).toBe("Hi");
    expect(data.offset).toBe(1);
    expect(data.hasMore).toBe(true);
  });

  it("skips non-message entries", async () => {
    const lines = [
      JSON.stringify({ type: "init", data: {} }),
      msgLine("user", "Hello", 0),
      JSON.stringify({ type: "tool_call", name: "search" }),
      msgLine("assistant", "Found it", 1),
    ];

    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.createReadStream.mockReturnValue(makeJsonlStream(lines));

    const res = await GET(makeRequest({ agentId: "alex", sessionId: UUID }));
    const data = await res.json();
    expect(data.total).toBe(2);
    expect(data.messages).toHaveLength(2);
  });

  it("falls back to archive path", async () => {
    const lines = [msgLine("user", "Archived msg", 0)];

    // First call (active) returns false, second (archive) returns true
    mockedFs.existsSync.mockReturnValueOnce(false).mockReturnValueOnce(true);
    mockedFs.createReadStream.mockReturnValue(makeJsonlStream(lines));

    const res = await GET(makeRequest({ agentId: "alex", sessionId: UUID }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.messages).toHaveLength(1);
    // Should have called createReadStream with archive path
    expect(mockedFs.createReadStream).toHaveBeenCalledWith(
      expect.stringContaining("archive"),
      expect.anything(),
    );
  });

  it("returns 404 when session not found", async () => {
    mockedFs.existsSync.mockReturnValue(false);

    const res = await GET(makeRequest({ agentId: "alex", sessionId: UUID }));
    expect(res.status).toBe(404);
  });

  it("resolves non-UUID session keys from sessions.json", async () => {
    const sessionsJson = {
      "agent:alex:main": { sessionId: UUID },
    };

    // existsSync: sessions.json=true, active JSONL=true
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(sessionsJson));
    mockedFs.createReadStream.mockReturnValue(makeJsonlStream([msgLine("user", "Hi", 0)]));

    const res = await GET(makeRequest({ agentId: "alex", sessionId: "main" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sessionId).toBe(UUID);
  });

  it("reads via sidecar when configured", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    const content = [msgLine("user", "Hello", 0), msgLine("assistant", "Hi", 1)].join("\n");
    mockSidecarGet.mockResolvedValue({
      ok: true,
      json: async () => ({ content }),
    });

    const res = await GET(makeRequest({ agentId: "alex", sessionId: UUID }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.total).toBe(2);
    expect(data.messages).toHaveLength(2);
  });

  it("sidecar tries archive path when active not found", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    mockSidecarGet
      .mockResolvedValueOnce({ ok: false }) // active fails
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: msgLine("user", "Archived", 0) }),
      });

    const res = await GET(makeRequest({ agentId: "alex", sessionId: UUID }));
    expect(res.status).toBe(200);
    expect(mockSidecarGet).toHaveBeenCalledTimes(2);
  });

  it("includes usage data when present", async () => {
    const line = JSON.stringify({
      type: "message",
      id: "msg-usage",
      message: {
        role: "assistant",
        content: "Response",
        timestamp: "2026-01-01T00:00:00Z",
        model: "claude-opus-4-6",
        usage: { input: 100, output: 50, cacheRead: 10, cacheWrite: 5, totalTokens: 165, cost: { input: 0.01, output: 0.005, cacheRead: 0.001, cacheWrite: 0.001, total: 0.017 } },
        stopReason: "end_turn",
      },
    });

    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.createReadStream.mockReturnValue(makeJsonlStream([line]));

    const res = await GET(makeRequest({ agentId: "alex", sessionId: UUID }));
    const data = await res.json();
    expect(data.messages[0].model).toBe("claude-opus-4-6");
    expect(data.messages[0].usage.totalTokens).toBe(165);
    expect(data.messages[0].stopReason).toBe("end_turn");
  });
});
