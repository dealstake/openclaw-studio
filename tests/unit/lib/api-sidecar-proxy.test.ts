import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock sidecar module
const mockIsSidecarConfigured = vi.fn<() => boolean>();
const mockSidecarGet = vi.fn();
const mockSidecarMutate = vi.fn();

vi.mock("@/lib/workspace/sidecar", () => ({
  isSidecarConfigured: () => mockIsSidecarConfigured(),
  sidecarGet: (...args: unknown[]) => mockSidecarGet(...args),
  sidecarMutate: (...args: unknown[]) => mockSidecarMutate(...args),
}));

import {
  withSidecarGetFallback,
  withSidecarMutateFallback,
} from "@/lib/api/sidecar-proxy";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("withSidecarGetFallback", () => {
  it("uses sidecar when configured", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    mockSidecarGet.mockResolvedValue({
      json: () => Promise.resolve({ data: "from-sidecar" }),
      status: 200,
    });

    const res = await withSidecarGetFallback(
      "/file",
      { agentId: "a", path: "b" },
      () => ({ data: "local" }),
    );
    const body = await res.json();

    expect(body).toEqual({ data: "from-sidecar" });
    expect(res.status).toBe(200);
    expect(mockSidecarGet).toHaveBeenCalledWith("/file", { agentId: "a", path: "b" });
  });

  it("preserves sidecar error status codes", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    mockSidecarGet.mockResolvedValue({
      json: () => Promise.resolve({ error: "not found" }),
      status: 404,
    });

    const res = await withSidecarGetFallback("/file", {}, () => ({}));
    expect(res.status).toBe(404);
  });

  it("falls back to local when sidecar is not configured", async () => {
    mockIsSidecarConfigured.mockReturnValue(false);

    const res = await withSidecarGetFallback(
      "/file",
      {},
      () => ({ data: "local" }),
    );
    const body = await res.json();

    expect(body).toEqual({ data: "local" });
    expect(res.status).toBe(200);
    expect(mockSidecarGet).not.toHaveBeenCalled();
  });

  it("supports async local functions", async () => {
    mockIsSidecarConfigured.mockReturnValue(false);

    const res = await withSidecarGetFallback(
      "/file",
      {},
      async () => ({ data: "async-local" }),
    );
    const body = await res.json();
    expect(body).toEqual({ data: "async-local" });
  });
});

describe("withSidecarMutateFallback", () => {
  it("uses sidecar when configured", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    mockSidecarMutate.mockResolvedValue({
      json: () => Promise.resolve({ ok: true }),
      status: 201,
    });

    const res = await withSidecarMutateFallback(
      "/file",
      "PUT",
      { content: "x" },
      () => ({ ok: true }),
    );
    expect(res.status).toBe(201);
    expect(mockSidecarMutate).toHaveBeenCalledWith("/file", "PUT", { content: "x" });
  });

  it("falls back to local when sidecar is not configured", async () => {
    mockIsSidecarConfigured.mockReturnValue(false);

    const res = await withSidecarMutateFallback(
      "/file",
      "PUT",
      {},
      () => ({ ok: true, size: 42 }),
    );
    const body = await res.json();

    expect(body).toEqual({ ok: true, size: 42 });
    expect(mockSidecarMutate).not.toHaveBeenCalled();
  });
});
