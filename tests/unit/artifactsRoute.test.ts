import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockListFiles = vi.fn();
vi.mock("@/lib/google/drive", () => ({
  listFiles: (...args: unknown[]) => mockListFiles(...args),
}));

vi.mock("@/lib/api/helpers", async () => {
  const { NextResponse } = await import("next/server");
  return {
    handleApiError: (_err: unknown, _tag: string, fallback?: string) => {
      return NextResponse.json({ error: fallback ?? "Internal server error." }, { status: 500 });
    },
  };
});

import { GET } from "@/app/api/artifacts/route";

const INTERNAL_KEY = process.env.ARTIFACTS_INTERNAL_KEY || "";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string> = {}) {
  const h: Record<string, string> = { ...headers };
  if (INTERNAL_KEY && !("X-Internal-Key" in h)) h["X-Internal-Key"] = INTERNAL_KEY;
  return new Request("http://localhost/api/artifacts", { headers: h }) as unknown as Request;
}

function makeUnauthRequest(headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/artifacts", { headers }) as unknown as Request;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/artifacts", () => {
  // The route uses a module-level cache with 30s TTL based on Date.now().
  // We advance time between tests to ensure cache is always stale.
  let now = 1000000;

  beforeEach(() => {
    vi.clearAllMocks();
    now += 60_000; // advance 60s to bust cache
    vi.spyOn(Date, "now").mockReturnValue(now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 500 on Drive failure with empty cache", async () => {
    // Must run first — module-level cache starts empty
    mockListFiles.mockRejectedValue(new Error("Drive API error"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });

  it("returns files from Drive", async () => {
    const files = [{ id: "f1", name: "test.pdf", modifiedTime: "2026-01-01" }];
    mockListFiles.mockResolvedValue({ files });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.files).toEqual(files);
    expect(data.count).toBe(1);
  });

  it("calls listFiles with pageSize and orderBy", async () => {
    mockListFiles.mockResolvedValue({ files: [] });

    await GET(makeRequest());
    expect(mockListFiles).toHaveBeenCalledWith({
      pageSize: 100,
      orderBy: "modifiedTime desc",
    });
  });

  it("returns empty file list", async () => {
    mockListFiles.mockResolvedValue({ files: [] });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.files).toEqual([]);
    expect(data.count).toBe(0);
  });

  it("returns cached data on Drive failure when cache exists", async () => {
    // Prime cache
    const files = [{ id: "cached" }];
    mockListFiles.mockResolvedValueOnce({ files });
    await GET(makeRequest());

    // Advance time past TTL
    now += 60_000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    // Next call fails but cache still has data
    mockListFiles.mockRejectedValueOnce(new Error("Drive down"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.files).toEqual(files);
  });

  it("returns 401 when auth key required but missing", async () => {
    if (!INTERNAL_KEY) return;
    const res = await GET(makeUnauthRequest());
    expect(res.status).toBe(401);
  });

  it("returns 401 when auth key is wrong", async () => {
    if (!INTERNAL_KEY) return;
    const res = await GET(makeUnauthRequest({ "X-Internal-Key": "wrong" }));
    expect(res.status).toBe(401);
  });
});
