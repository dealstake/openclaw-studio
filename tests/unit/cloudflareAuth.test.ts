import { describe, it, expect, vi, beforeEach } from "vitest";
import { getCfIdentity, _resetCfIdentityCache, logout } from "@/lib/cloudflare-auth";

// Mock branding config
vi.mock("@/lib/branding/config", () => ({
  BRANDING: { identityUrl: "https://test.example.com/cdn-cgi/access/get-identity" },
}));

describe("cloudflare-auth", () => {
  beforeEach(() => {
    _resetCfIdentityCache();
    vi.restoreAllMocks();
  });

  it("returns identity on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ email: "user@test.com", name: "Test User" }), { status: 200 })
    );
    const identity = await getCfIdentity();
    expect(identity).toEqual({ email: "user@test.com", name: "Test User" });
  });

  it("caches result after first fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ email: "user@test.com" }), { status: 200 })
    );
    await getCfIdentity();
    await getCfIdentity();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns null and caches on non-ok response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Forbidden", { status: 403 })
    );
    const result = await getCfIdentity();
    expect(result).toBeNull();
    // Second call should not re-fetch
    await getCfIdentity();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("returns null on network error without caching (allows retry)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));
    const result = await getCfIdentity();
    expect(result).toBeNull();
    // Should retry on next call
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ email: "user@test.com" }), { status: 200 })
    );
    const result2 = await getCfIdentity();
    expect(result2).toEqual({ email: "user@test.com" });
  });

  it("_resetCfIdentityCache clears cached state", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ email: "user@test.com" }), { status: 200 })
    );
    await getCfIdentity();
    _resetCfIdentityCache();
    await getCfIdentity();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns null when response has no email", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ name: "No Email" }), { status: 200 })
    );
    const result = await getCfIdentity();
    expect(result).toBeNull();
  });

  it("logout redirects to /logout", () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: "" },
    });
    logout();
    expect(window.location.href).toBe("/logout");
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });
});
