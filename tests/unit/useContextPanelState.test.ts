import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useContextPanelState } from "@/hooks/useContextPanelState";

const localStorageMap = new Map<string, string>();
beforeEach(() => {
  localStorageMap.clear();
  vi.spyOn(window.localStorage, "getItem").mockImplementation((key) => localStorageMap.get(key) ?? null);
  vi.spyOn(window.localStorage, "setItem").mockImplementation((key, value) => {
    localStorageMap.set(key, value);
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("useContextPanelState", () => {
  it("returns default state", () => {
    const { result } = renderHook(() => useContextPanelState());
    expect(result.current.contextPanelOpen).toBe(true);
    expect(result.current.contextMode).toBe("agent");
    expect(result.current.contextTab).toBe("projects");
    expect(result.current.expandedTab).toBeNull();
  });

  it("reads contextPanelOpen from localStorage", () => {
    localStorageMap.set("studio:context-panel-open", "false");
    const { result } = renderHook(() => useContextPanelState());
    expect(result.current.contextPanelOpen).toBe(false);
  });

  it("persists contextPanelOpen to localStorage", () => {
    const { result } = renderHook(() => useContextPanelState());
    act(() => result.current.setContextPanelOpen(false));
    expect(localStorageMap.get("studio:context-panel-open")).toBe("false");
  });

  it("toggles context mode", () => {
    const { result } = renderHook(() => useContextPanelState());
    act(() => result.current.setContextMode("files"));
    expect(result.current.contextMode).toBe("files");
  });

  it("changes context tab", () => {
    const { result } = renderHook(() => useContextPanelState());
    act(() => result.current.setContextTab("tasks"));
    expect(result.current.contextTab).toBe("tasks");
  });

  it("sets and clears expanded tab", () => {
    const { result } = renderHook(() => useContextPanelState());
    act(() => result.current.setExpandedTab("brain"));
    expect(result.current.expandedTab).toBe("brain");
    act(() => result.current.clearExpandedTab());
    expect(result.current.expandedTab).toBeNull();
  });
});
