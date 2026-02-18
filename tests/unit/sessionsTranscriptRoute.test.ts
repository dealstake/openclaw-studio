import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/workspace/sidecar", () => ({
  isSidecarConfigured: vi.fn(() => false),
  sidecarGet: vi.fn(),
  SidecarUnavailableError: class extends Error { name = "SidecarUnavailableError"; },
}));

import { GET } from "@/app/api/sessions/transcript/route";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";

const mockedIsSidecar = vi.mocked(isSidecarConfigured);
const mockedSidecarGet = vi.mocked(sidecarGet);

function makeRequest(params: Record<string, string>): Request {
  const url = new URL("http://localhost/api/sessions/transcript");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url, { method: "GET" });
}

describe("GET /api/sessions/transcript", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects missing agentId", async () => {
    const res = await GET(makeRequest({ sessionId: "s1" }));
    expect(res.status).toBe(400);
  });

  it("rejects unsafe agentId", async () => {
    const res = await GET(makeRequest({ agentId: "../bad", sessionId: "s1" }));
    expect(res.status).toBe(400);
  });

  it("rejects missing sessionId", async () => {
    const res = await GET(makeRequest({ agentId: "agent-1" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("sessionId");
  });

  it("returns 503 when sidecar not configured", async () => {
    mockedIsSidecar.mockReturnValue(false);
    const res = await GET(makeRequest({ agentId: "agent-1", sessionId: "s1" }));
    expect(res.status).toBe(503);
  });

  it("proxies to sidecar when configured", async () => {
    mockedIsSidecar.mockReturnValue(true);
    mockedSidecarGet.mockResolvedValue(
      new Response(JSON.stringify({ messages: [{ role: "user", text: "hi" }] }), { status: 200 })
    );

    const res = await GET(makeRequest({ agentId: "agent-1", sessionId: "s1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.messages).toHaveLength(1);
    expect(mockedSidecarGet).toHaveBeenCalledWith("/sessions/transcript", expect.objectContaining({
      agentId: "agent-1",
      sessionId: "s1",
    }));
  });

  it("forwards sidecar error status", async () => {
    mockedIsSidecar.mockReturnValue(true);
    mockedSidecarGet.mockResolvedValue(
      new Response(JSON.stringify({ error: "not found" }), { status: 404 })
    );

    const res = await GET(makeRequest({ agentId: "agent-1", sessionId: "s1" }));
    expect(res.status).toBe(404);
  });
});
