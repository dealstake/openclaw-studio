import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCfIdentity, _resetCfIdentityCache } from "@/lib/cloudflare-auth";

// Mock branding to provide a stable identityUrl
vi.mock("@/lib/branding/config", () => ({
  BRANDING: { identityUrl: "https://test.example.com/.identity" },
}));

describe("getCfIdentity", () => {
  beforeEach(() => {
    _resetCfIdentityCache();
    vi.restoreAllMocks();
  });

  it("returns identity on successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ email: "a@b.com", name: "Alice" }),
      }),
    );
    const result = await getCfIdentity();
    expect(result).toEqual({ email: "a@b.com", name: "Alice" });
  });

  it("caches successful result and does not re-fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ email: "a@b.com", name: "Alice" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await getCfIdentity();
    const second = await getCfIdentity();

    expect(second).toEqual({ email: "a@b.com", name: "Alice" });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("caches null on non-200 response and does not re-fetch", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    vi.stubGlobal("fetch", mockFetch);

    const first = await getCfIdentity();
    const second = await getCfIdentity();

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("caches null when response has no email", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ foo: "bar" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const first = await getCfIdentity();
    const second = await getCfIdentity();

    expect(first).toBeNull();
    expect(second).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not cache on network error (allows retry)", async () => {
    const mockFetch = vi
      .fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ email: "a@b.com" }),
      });
    vi.stubGlobal("fetch", mockFetch);

    const first = await getCfIdentity();
    expect(first).toBeNull();

    const second = await getCfIdentity();
    expect(second).toEqual({ email: "a@b.com" });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("_resetCfIdentityCache clears the cache", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ email: "a@b.com" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await getCfIdentity();
    _resetCfIdentityCache();
    await getCfIdentity();

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
