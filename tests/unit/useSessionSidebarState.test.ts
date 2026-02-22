import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useSessionSidebarState } from "@/hooks/useSessionSidebarState";

const localStorageMap = new Map<string, string>();
beforeEach(() => {
  localStorageMap.clear();
  vi.spyOn(window.localStorage, "getItem").mockImplementation((key) => localStorageMap.get(key) ?? null);
  vi.spyOn(window.localStorage, "setItem").mockImplementation((key, value) => {
    localStorageMap.set(key, value);
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("useSessionSidebarState", () => {
  it("returns default state", () => {
    const { result } = renderHook(() => useSessionSidebarState());
    expect(result.current.sessionSidebarCollapsed).toBe(false);
    expect(result.current.mobileSessionDrawerOpen).toBe(false);
  });

  it("reads collapsed from localStorage", () => {
    localStorageMap.set("studio:session-sidebar-collapsed", "true");
    const { result } = renderHook(() => useSessionSidebarState());
    expect(result.current.sessionSidebarCollapsed).toBe(true);
  });

  it("persists collapsed to localStorage", () => {
    const { result } = renderHook(() => useSessionSidebarState());
    act(() => result.current.setSessionSidebarCollapsed(true));
    expect(localStorageMap.get("studio:session-sidebar-collapsed")).toBe("true");
  });

  it("toggles mobile drawer", () => {
    const { result } = renderHook(() => useSessionSidebarState());
    act(() => result.current.setMobileSessionDrawerOpen(true));
    expect(result.current.mobileSessionDrawerOpen).toBe(true);
    act(() => result.current.setMobileSessionDrawerOpen(false));
    expect(result.current.mobileSessionDrawerOpen).toBe(false);
  });
});
