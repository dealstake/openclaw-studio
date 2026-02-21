import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockReadWorkspaceFile = vi.fn();
vi.mock("@/lib/workspace/resolve", () => ({
  readWorkspaceFile: (...args: unknown[]) => mockReadWorkspaceFile(...args),
  isSafeAgentId: (id: string) => /^[a-zA-Z0-9_-]+$/.test(id),
}));

const mockIsSidecarConfigured = vi.fn(() => false);
const mockSidecarGet = vi.fn();
vi.mock("@/lib/workspace/sidecar", () => ({
  isSidecarConfigured: () => mockIsSidecarConfigured(),
  sidecarGet: (...args: unknown[]) => mockSidecarGet(...args),
}));

vi.mock("@/lib/api/helpers", async () => {
  const actual = await vi.importActual("@/lib/api/helpers");
  return actual;
});

import { POST } from "@/app/api/workspace/files/batch/route";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/workspace/files/batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as Request;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /api/workspace/files/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSidecarConfigured.mockReturnValue(false);
  });

  it("returns 400 when agentId is missing", async () => {
    const res = await POST(makeRequest({ paths: ["a.md"] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for unsafe agentId", async () => {
    const res = await POST(makeRequest({ agentId: "../evil", paths: ["a.md"] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when paths is empty", async () => {
    const res = await POST(makeRequest({ agentId: "alex", paths: [] }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when paths is not an array", async () => {
    const res = await POST(makeRequest({ agentId: "alex", paths: "file.md" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when paths exceeds 50", async () => {
    const paths = Array.from({ length: 51 }, (_, i) => `file${i}.md`);
    const res = await POST(makeRequest({ agentId: "alex", paths }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/50/);
  });

  it("reads files in local mode", async () => {
    mockReadWorkspaceFile
      .mockReturnValueOnce({ content: "hello" })
      .mockReturnValueOnce({ content: "world" });

    const res = await POST(makeRequest({ agentId: "alex", paths: ["a.md", "b.md"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.files).toEqual([
      { path: "a.md", content: "hello" },
      { path: "b.md", content: "world" },
    ]);
  });

  it("returns null content when local file not found", async () => {
    mockReadWorkspaceFile.mockReturnValue({ content: undefined });

    const res = await POST(makeRequest({ agentId: "alex", paths: ["missing.md"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.files[0].content).toBeNull();
  });

  it("reads files via sidecar when configured", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    mockSidecarGet.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ content: "sidecar content" }),
    });

    const res = await POST(makeRequest({ agentId: "alex", paths: ["file.md"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.files[0].content).toBe("sidecar content");
    expect(mockSidecarGet).toHaveBeenCalledWith("/file", { agentId: "alex", path: "file.md" });
  });

  it("returns error for sidecar non-404 failure", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    mockSidecarGet.mockResolvedValue({ ok: false, status: 500 });

    const res = await POST(makeRequest({ agentId: "alex", paths: ["file.md"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.files[0].error).toBe("HTTP 500");
    expect(data.files[0].content).toBeNull();
  });

  it("returns null for sidecar 404", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    mockSidecarGet.mockResolvedValue({ ok: false, status: 404 });

    const res = await POST(makeRequest({ agentId: "alex", paths: ["gone.md"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.files[0].content).toBeNull();
    expect(data.files[0].error).toBeUndefined();
  });

  it("handles thrown errors per file gracefully", async () => {
    mockReadWorkspaceFile.mockImplementation(() => {
      throw new Error("disk error");
    });

    const res = await POST(makeRequest({ agentId: "alex", paths: ["bad.md"] }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.files[0].error).toBe("disk error");
    expect(data.files[0].content).toBeNull();
  });

  it("sets Cache-Control header", async () => {
    mockReadWorkspaceFile.mockReturnValue({ content: "x" });

    const res = await POST(makeRequest({ agentId: "alex", paths: ["a.md"] }));
    expect(res.headers.get("Cache-Control")).toContain("max-age=30");
  });
});
