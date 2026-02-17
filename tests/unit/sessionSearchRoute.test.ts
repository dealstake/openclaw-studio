import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// Mock the sidecar module before importing the route
vi.mock("@/lib/workspace/sidecar", () => ({
  isSidecarConfigured: vi.fn(),
  sidecarGet: vi.fn(),
}));

import { GET } from "@/app/api/sessions/search/route";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";

const makeRequest = (url: string) =>
  new Request(`http://localhost:3000${url}`);

const mockIsSidecarConfigured = vi.mocked(isSidecarConfigured);
const mockSidecarGet = vi.mocked(sidecarGet);

beforeEach(() => {
  vi.clearAllMocks();
  mockIsSidecarConfigured.mockReturnValue(true);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("GET /api/sessions/search", () => {
  it("returns 400 when agentId is missing", async () => {
    const resp = await GET(makeRequest("/api/sessions/search?query=test"));
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/agentId/);
  });

  it("returns 400 when query is missing", async () => {
    const resp = await GET(makeRequest("/api/sessions/search?agentId=alex"));
    expect(resp.status).toBe(400);
    const body = await resp.json();
    expect(body.error).toMatch(/query/);
  });

  it("returns 503 when sidecar is not configured", async () => {
    mockIsSidecarConfigured.mockReturnValue(false);
    const resp = await GET(
      makeRequest("/api/sessions/search?agentId=alex&query=test")
    );
    expect(resp.status).toBe(503);
  });

  it("proxies to sidecar and returns results", async () => {
    const mockData = {
      results: [
        {
          sessionId: "abc-123",
          sessionKey: "agent:alex:main",
          archived: false,
          startedAt: "2026-02-17T00:00:00Z",
          updatedAt: "2026-02-17T01:00:00Z",
          matches: [
            { role: "user", timestamp: "2026-02-17T00:05:00Z", snippet: "test snippet" },
          ],
        },
      ],
      count: 1,
      query: "test",
    };
    mockSidecarGet.mockResolvedValue(
      new Response(JSON.stringify(mockData), { status: 200 })
    );

    const resp = await GET(
      makeRequest("/api/sessions/search?agentId=alex&query=test&limit=10")
    );
    expect(resp.status).toBe(200);
    const body = await resp.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].sessionId).toBe("abc-123");
    expect(body.results[0].matches[0].snippet).toBe("test snippet");

    expect(mockSidecarGet).toHaveBeenCalledWith("/sessions/search", {
      agentId: "alex",
      query: "test",
      limit: "10",
    });
  });

  it("handles sidecar errors gracefully", async () => {
    mockSidecarGet.mockRejectedValue(new Error("Connection refused"));
    const resp = await GET(
      makeRequest("/api/sessions/search?agentId=alex&query=test")
    );
    expect(resp.status).toBe(500);
    const body = await resp.json();
    expect(body.error).toMatch(/Connection refused/);
  });
});
