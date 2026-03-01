/**
 * Unit tests for useCurrentUser hook.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

afterEach(cleanup);

// ── Mock cloudflare-auth ──────────────────────────────────────────────────────

vi.mock("@/lib/cloudflare-auth", () => ({
  getCfIdentity: vi.fn(),
  _resetCfIdentityCache: vi.fn(),
}));

import { getCfIdentity } from "@/lib/cloudflare-auth";
import { useCurrentUser } from "@/features/rbac/hooks/useCurrentUser";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("useCurrentUser", () => {
  afterEach(() => vi.clearAllMocks());

  it("starts in loading state", async () => {
    // Never resolves — keep it pending
    vi.mocked(getCfIdentity).mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useCurrentUser());
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("resolves user with CF identity email and name", async () => {
    vi.mocked(getCfIdentity).mockResolvedValue({
      email: "alice@example.com",
      name: "Alice Smith",
    });

    const { result } = renderHook(() => useCurrentUser());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.user).not.toBeNull();
    expect(result.current.user?.email).toBe("alice@example.com");
    expect(result.current.user?.name).toBe("Alice Smith");
    expect(result.current.user?.role).toBe("admin"); // Phase 1 default
  });

  it("derives name from email when CF identity has no name", async () => {
    vi.mocked(getCfIdentity).mockResolvedValue({
      email: "john.doe@example.com",
    });

    const { result } = renderHook(() => useCurrentUser());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.user?.name).toBe("John Doe");
  });

  it("falls back to dev user when CF identity is null (local mode)", async () => {
    vi.mocked(getCfIdentity).mockResolvedValue(null);

    const { result } = renderHook(() => useCurrentUser());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.user?.email).toBe("dev@local");
    expect(result.current.user?.name).toBe("Dev User");
    expect(result.current.user?.role).toBe("admin");
  });

  it("sets error when getCfIdentity throws", async () => {
    vi.mocked(getCfIdentity).mockRejectedValue(new Error("Network failure"));

    const { result } = renderHook(() => useCurrentUser());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.error).toBe("Network failure");
  });

  it("sets generic error message for non-Error throws", async () => {
    vi.mocked(getCfIdentity).mockRejectedValue("unexpected");

    const { result } = renderHook(() => useCurrentUser());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toBe("Failed to resolve user");
  });
});
