import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// Re-import module fresh each test to reset module-level cache
let useRecentItems: typeof import("@/features/command-palette/hooks/useRecentItems").useRecentItems;

beforeEach(async () => {
  localStorage.clear();
  // Reset the module to clear cachedItems
  vi.resetModules();
  const mod = await import("@/features/command-palette/hooks/useRecentItems");
  useRecentItems = mod.useRecentItems;
});

describe("useRecentItems", () => {
  it("starts with empty list", () => {
    const { result } = renderHook(() => useRecentItems());
    expect(result.current.recentItems).toEqual([]);
  });

  it("tracks a recent item", () => {
    const { result } = renderHook(() => useRecentItems());
    act(() => result.current.trackRecent("nav-projects", "Go to Projects"));
    expect(result.current.recentItems).toHaveLength(1);
    expect(result.current.recentItems[0].id).toBe("nav-projects");
    expect(result.current.recentItems[0].label).toBe("Go to Projects");
  });

  it("moves duplicate to top", () => {
    const { result } = renderHook(() => useRecentItems());
    act(() => result.current.trackRecent("a", "A"));
    act(() => result.current.trackRecent("b", "B"));
    act(() => result.current.trackRecent("a", "A"));
    expect(result.current.recentItems[0].id).toBe("a");
    expect(result.current.recentItems).toHaveLength(2);
  });

  it("limits to 5 items", () => {
    const { result } = renderHook(() => useRecentItems());
    for (let i = 0; i < 7; i++) {
      act(() => result.current.trackRecent(`item-${i}`, `Item ${i}`));
    }
    expect(result.current.recentItems).toHaveLength(5);
    expect(result.current.recentItems[0].id).toBe("item-6");
  });

  it("clearRecent empties the list", () => {
    const { result } = renderHook(() => useRecentItems());
    act(() => result.current.trackRecent("a", "A"));
    act(() => result.current.clearRecent());
    expect(result.current.recentItems).toEqual([]);
  });

  it("persists to localStorage", () => {
    const { result } = renderHook(() => useRecentItems());
    act(() => result.current.trackRecent("nav-brain", "Go to Brain"));
    const stored = JSON.parse(localStorage.getItem("studio:command-palette-recent") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("nav-brain");
  });

  it("handles corrupted localStorage gracefully", () => {
    localStorage.setItem("studio:command-palette-recent", "not-json");
    const { result } = renderHook(() => useRecentItems());
    expect(result.current.recentItems).toEqual([]);
  });
});
