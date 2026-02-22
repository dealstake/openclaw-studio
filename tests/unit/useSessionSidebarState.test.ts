import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useSessionSidebarState } from "@/hooks/useSessionSidebarState";

const store = new Map<string, string>();
const mockStorage = {
  getItem: vi.fn((key: string) => store.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
  removeItem: vi.fn((key: string) => { store.delete(key); }),
  clear: vi.fn(() => { store.clear(); }),
  get length() { return store.size; },
  key: vi.fn((i: number) => Array.from(store.keys())[i] ?? null),
};

beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", mockStorage);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("useSessionSidebarState", () => {
  it("returns default state", () => {
    const { result } = renderHook(() => useSessionSidebarState());
    expect(result.current.sessionSidebarCollapsed).toBe(false);
    expect(result.current.mobileSessionDrawerOpen).toBe(false);
  });

  it("reads collapsed from localStorage", () => {
    store.set("studio:session-sidebar-collapsed", "true");
    const { result } = renderHook(() => useSessionSidebarState());
    expect(result.current.sessionSidebarCollapsed).toBe(true);
  });

  it("persists collapsed to localStorage", () => {
    const { result } = renderHook(() => useSessionSidebarState());
    act(() => result.current.setSessionSidebarCollapsed(true));
    expect(store.get("studio:session-sidebar-collapsed")).toBe("true");
  });

  it("toggles mobile drawer", () => {
    const { result } = renderHook(() => useSessionSidebarState());
    act(() => result.current.setMobileSessionDrawerOpen(true));
    expect(result.current.mobileSessionDrawerOpen).toBe(true);
    act(() => result.current.setMobileSessionDrawerOpen(false));
    expect(result.current.mobileSessionDrawerOpen).toBe(false);
  });
});
