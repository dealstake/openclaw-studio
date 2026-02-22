import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRecentItems } from "@/features/command-palette/hooks/useRecentItems";

// The hook uses a module-level cache, so we must clear localStorage
// AND re-import to reset. Instead, we work with the cumulative state.

beforeEach(() => {
  localStorage.clear();
  // Force cache invalidation by removing the storage key
  // The module cache persists, but readFromStorage re-reads on cache miss
});

describe("useRecentItems", () => {
  it("tracks and clears recent items", () => {
    const { result } = renderHook(() => useRecentItems());

    // Clear any stale state from prior tests
    act(() => result.current.clearRecent());
    expect(result.current.recentItems).toEqual([]);

    // Track items
    act(() => result.current.trackRecent("nav-projects", "Go to Projects"));
    expect(result.current.recentItems).toHaveLength(1);
    expect(result.current.recentItems[0].id).toBe("nav-projects");

    // Track more — most recent first
    act(() => result.current.trackRecent("nav-tasks", "Go to Tasks"));
    expect(result.current.recentItems[0].id).toBe("nav-tasks");

    // Re-access moves to top
    act(() => result.current.trackRecent("nav-projects", "Go to Projects"));
    expect(result.current.recentItems[0].id).toBe("nav-projects");
    expect(result.current.recentItems).toHaveLength(2);

    // Clear
    act(() => result.current.clearRecent());
    expect(result.current.recentItems).toEqual([]);
  });

  it("limits to 5 recent items", () => {
    const { result } = renderHook(() => useRecentItems());
    act(() => result.current.clearRecent());

    act(() => {
      for (let i = 0; i < 7; i++) {
        result.current.trackRecent(`item-${i}`, `Item ${i}`);
      }
    });
    expect(result.current.recentItems).toHaveLength(5);
    expect(result.current.recentItems[0].id).toBe("item-6");
  });

  it("persists to localStorage", () => {
    const { result } = renderHook(() => useRecentItems());
    act(() => result.current.clearRecent());
    act(() => result.current.trackRecent("nav-tasks", "Go to Tasks"));
    const stored = JSON.parse(localStorage.getItem("studio:command-palette-recent") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("nav-tasks");
  });
});
