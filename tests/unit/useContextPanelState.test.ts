import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useContextPanelState } from "@/hooks/useContextPanelState";

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

describe("useContextPanelState", () => {
  it("returns default state", () => {
    const { result } = renderHook(() => useContextPanelState());
    expect(result.current.contextPanelOpen).toBe(false);
    expect(result.current.contextMode).toBe("agent");
    expect(result.current.contextTab).toBe("projects");
    expect(result.current.expandedTab).toBeNull();
  });

  it("reads contextPanelOpen from localStorage", () => {
    store.set("studio:context-panel-open", "false");
    const { result } = renderHook(() => useContextPanelState());
    expect(result.current.contextPanelOpen).toBe(false);
  });

  it("persists contextPanelOpen to localStorage", () => {
    const { result } = renderHook(() => useContextPanelState());
    act(() => result.current.setContextPanelOpen(false));
    expect(store.get("studio:context-panel-open")).toBe("false");
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
    act(() => result.current.setExpandedTab("workspace"));
    expect(result.current.expandedTab).toBe("workspace");
    act(() => result.current.clearExpandedTab());
    expect(result.current.expandedTab).toBeNull();
  });
});
