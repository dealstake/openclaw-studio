import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRecentItems } from "@/features/command-palette/hooks/useRecentItems";

beforeEach(() => {
  localStorage.clear();
});

describe("useRecentItems", () => {
  it("starts with empty recent items", () => {
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

  it("deduplicates and moves to front on re-track", () => {
    const { result } = renderHook(() => useRecentItems());
    act(() => result.current.trackRecent("nav-projects", "Go to Projects"));
    act(() => result.current.trackRecent("nav-sessions", "Go to Sessions"));
    act(() => result.current.trackRecent("nav-projects", "Go to Projects"));
    expect(result.current.recentItems).toHaveLength(2);
    expect(result.current.recentItems[0].id).toBe("nav-projects");
  });

  it("limits to 5 items", () => {
    const { result } = renderHook(() => useRecentItems());
    for (let i = 0; i < 7; i++) {
      act(() => result.current.trackRecent(`item-${i}`, `Item ${i}`));
    }
    expect(result.current.recentItems).toHaveLength(5);
    expect(result.current.recentItems[0].id).toBe("item-6");
  });

  it("clears all recent items", () => {
    const { result } = renderHook(() => useRecentItems());
    act(() => result.current.trackRecent("nav-projects", "Go to Projects"));
    act(() => result.current.clearRecent());
    expect(result.current.recentItems).toEqual([]);
  });

  it("persists to localStorage", () => {
    const { result } = renderHook(() => useRecentItems());
    act(() => result.current.trackRecent("nav-projects", "Go to Projects"));
    const stored = JSON.parse(localStorage.getItem("studio:command-palette-recent") ?? "[]");
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe("nav-projects");
  });
});
