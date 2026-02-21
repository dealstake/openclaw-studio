import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockIsSidecarConfigured = vi.fn(() => false);
const mockIsSidecarHealthy = vi.fn(() => Promise.resolve(true));
vi.mock("@/lib/workspace/sidecar", () => ({
  isSidecarConfigured: () => mockIsSidecarConfigured(),
  isSidecarHealthy: () => mockIsSidecarHealthy(),
}));

import { GET } from "@/app/api/workspace/health/route";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("GET /api/workspace/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSidecarConfigured.mockReturnValue(false);
  });

  it("returns local mode when sidecar not configured", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ configured: false, healthy: true, mode: "local" });
  });

  it("returns healthy sidecar mode", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    mockIsSidecarHealthy.mockResolvedValue(true);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ configured: true, healthy: true, mode: "sidecar" });
  });

  it("returns 503 when sidecar is unhealthy", async () => {
    mockIsSidecarConfigured.mockReturnValue(true);
    mockIsSidecarHealthy.mockResolvedValue(false);

    const res = await GET();
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data).toEqual({ configured: true, healthy: false, mode: "sidecar" });
  });
});
