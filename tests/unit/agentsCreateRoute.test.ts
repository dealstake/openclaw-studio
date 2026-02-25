import { beforeEach, describe, expect, it, vi } from "vitest";
import * as fs from "node:fs";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return { default: actual, ...actual, mkdirSync: vi.fn(), writeFileSync: vi.fn(), existsSync: vi.fn() };
});

const mockedFs = vi.mocked(fs);

import { POST } from "@/app/api/agents/create/route";

function makeRequest(body: Record<string, unknown>) {
  return new Request("http://localhost/api/agents/create", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as import("next/server").NextRequest;
}

describe("POST /api/agents/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedFs.existsSync.mockReturnValue(false);
  });

  it("rejects missing agentId", async () => {
    const res = await POST(makeRequest({ name: "Bot", purpose: "Test" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("agentId");
  });

  it("rejects unsafe agentId with path traversal", async () => {
    const res = await POST(makeRequest({ agentId: "../evil", name: "Bot", purpose: "Test" }));
    expect(res.status).toBe(400);
  });

  it("rejects missing name", async () => {
    const res = await POST(makeRequest({ agentId: "test-agent", purpose: "Test" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("name");
  });

  it("rejects empty name", async () => {
    const res = await POST(makeRequest({ agentId: "test-agent", name: "  ", purpose: "Test" }));
    expect(res.status).toBe(400);
  });

  it("rejects missing purpose", async () => {
    const res = await POST(makeRequest({ agentId: "test-agent", name: "Bot" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("purpose");
  });

  it("creates agent directory and brain files", async () => {
    const res = await POST(makeRequest({ agentId: "test-agent", name: "TestBot", purpose: "Do testing" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.agentId).toBe("test-agent");
    expect(data.filesCreated).toEqual(["SOUL.md", "AGENTS.md", "HEARTBEAT.md", "MEMORY.md"]);

    // Should create directories
    expect(mockedFs.mkdirSync).toHaveBeenCalledWith(expect.stringContaining("test-agent"), { recursive: true });

    // Should write 4 brain files
    expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(4);

    // SOUL.md should contain the name and purpose
    const soulCall = mockedFs.writeFileSync.mock.calls.find(
      (c) => typeof c[0] === "string" && c[0].endsWith("SOUL.md")
    );
    expect(soulCall).toBeDefined();
    expect(soulCall![1]).toContain("TestBot");
    expect(soulCall![1]).toContain("Do testing");
  });

  it("does not overwrite existing brain files", async () => {
    mockedFs.existsSync.mockReturnValue(true);

    const res = await POST(makeRequest({ agentId: "test-agent", name: "TestBot", purpose: "Do testing" }));
    expect(res.status).toBe(200);

    // Directories still created, but no files written
    expect(mockedFs.writeFileSync).not.toHaveBeenCalled();
  });

  it("trims agentId whitespace", async () => {
    const res = await POST(makeRequest({ agentId: " test-agent ", name: "Bot", purpose: "Test" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.agentId).toBe("test-agent");
  });
});
