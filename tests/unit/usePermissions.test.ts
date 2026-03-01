/**
 * Unit tests for usePermissions hook.
 *
 * Mocks useCurrentUser to test permission logic in isolation.
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup } from "@testing-library/react";
import { usePermissions } from "@/features/rbac/hooks/usePermissions";
import type { StudioUser } from "@/features/rbac/lib/types";

afterEach(cleanup);

// ── Mock useCurrentUser ───────────────────────────────────────────────────────

vi.mock("@/features/rbac/hooks/useCurrentUser", () => ({
  useCurrentUser: vi.fn(),
}));

import { useCurrentUser } from "@/features/rbac/hooks/useCurrentUser";

function setUser(user: StudioUser | null, loading = false) {
  vi.mocked(useCurrentUser).mockReturnValue({ user, loading, error: null });
}

function makeUser(role: StudioUser["role"]): StudioUser {
  return { email: "test@example.com", name: "Test User", role };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("usePermissions", () => {
  afterEach(() => vi.clearAllMocks());

  describe("loading state", () => {
    it("returns loading=true while user is loading", () => {
      setUser(null, true);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.loading).toBe(true);
    });

    it("can() returns false while loading (no user)", () => {
      setUser(null, true);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can("agents:view")).toBe(false);
    });
  });

  describe("null user (unauthenticated)", () => {
    it("can() returns false for any action", () => {
      setUser(null);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can("agents:view")).toBe(false);
      expect(result.current.can("users:manage")).toBe(false);
    });

    it("canAll() returns false for any actions", () => {
      setUser(null);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canAll(["agents:view", "sessions:view"])).toBe(false);
    });

    it("canAll() returns true for empty array even with null user", () => {
      setUser(null);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canAll([])).toBe(true);
    });

    it("atLeast() returns false for any role", () => {
      setUser(null);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.atLeast("viewer")).toBe(false);
      expect(result.current.atLeast("admin")).toBe(false);
    });
  });

  describe("admin user", () => {
    it("can() returns true for any valid action", () => {
      setUser(makeUser("admin"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can("users:manage")).toBe(true);
      expect(result.current.can("config:edit")).toBe(true);
      expect(result.current.can("gateway:restart")).toBe(true);
      expect(result.current.can("agents:view")).toBe(true);
    });

    it("canAll() returns true for multiple actions", () => {
      setUser(makeUser("admin"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canAll(["agents:manage", "users:manage", "config:edit"])).toBe(true);
    });

    it("atLeast('admin') returns true", () => {
      setUser(makeUser("admin"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.atLeast("admin")).toBe(true);
    });

    it("atLeast('operator') returns true", () => {
      setUser(makeUser("admin"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.atLeast("operator")).toBe(true);
    });

    it("atLeast('viewer') returns true", () => {
      setUser(makeUser("admin"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.atLeast("viewer")).toBe(true);
    });

    it("exposes the user object", () => {
      const user = makeUser("admin");
      setUser(user);
      const { result } = renderHook(() => usePermissions());
      expect(result.current.user).toEqual(user);
    });
  });

  describe("operator user", () => {
    it("can() returns true for agents:manage", () => {
      setUser(makeUser("operator"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can("agents:manage")).toBe(true);
    });

    it("can() returns false for users:manage", () => {
      setUser(makeUser("operator"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can("users:manage")).toBe(false);
    });

    it("can() returns false for config:edit", () => {
      setUser(makeUser("operator"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can("config:edit")).toBe(false);
    });

    it("canAll() returns false when any action is denied", () => {
      setUser(makeUser("operator"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canAll(["agents:manage", "users:manage"])).toBe(false);
    });

    it("atLeast('operator') returns true", () => {
      setUser(makeUser("operator"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.atLeast("operator")).toBe(true);
    });

    it("atLeast('admin') returns false", () => {
      setUser(makeUser("operator"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.atLeast("admin")).toBe(false);
    });
  });

  describe("viewer user", () => {
    it("can() returns true for agents:view", () => {
      setUser(makeUser("viewer"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can("agents:view")).toBe(true);
    });

    it("can() returns false for agents:manage", () => {
      setUser(makeUser("viewer"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can("agents:manage")).toBe(false);
    });

    it("can() returns false for sessions:delete", () => {
      setUser(makeUser("viewer"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.can("sessions:delete")).toBe(false);
    });

    it("atLeast('viewer') returns true", () => {
      setUser(makeUser("viewer"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.atLeast("viewer")).toBe(true);
    });

    it("atLeast('operator') returns false", () => {
      setUser(makeUser("viewer"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.atLeast("operator")).toBe(false);
    });
  });

  describe("canAll edge cases", () => {
    it("returns true for empty actions array", () => {
      setUser(makeUser("viewer"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canAll([])).toBe(true);
    });

    it("returns true for single allowed action", () => {
      setUser(makeUser("admin"));
      const { result } = renderHook(() => usePermissions());
      expect(result.current.canAll(["users:manage"])).toBe(true);
    });
  });
});
