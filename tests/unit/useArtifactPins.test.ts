import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useArtifactPins } from "@/features/artifacts/hooks/useArtifactPins";

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    store[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  }),
  get length() {
    return Object.keys(store).length;
  },
  key: vi.fn(() => null),
};

Object.defineProperty(globalThis, "localStorage", { value: localStorageMock });

describe("useArtifactPins", () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  it("initializes with empty pins and newest sort", () => {
    const { result } = renderHook(() => useArtifactPins());
    expect(result.current.pins.size).toBe(0);
    expect(result.current.sortDir).toBe("newest");
  });

  it("toggles a pin on and off", () => {
    const { result } = renderHook(() => useArtifactPins());

    act(() => result.current.togglePin("abc"));
    expect(result.current.pins.has("abc")).toBe(true);

    act(() => result.current.togglePin("abc"));
    expect(result.current.pins.has("abc")).toBe(false);
  });

  it("persists pins to localStorage", () => {
    const { result } = renderHook(() => useArtifactPins());

    act(() => result.current.togglePin("file-1"));
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      "studio:artifacts-pins",
      expect.any(String),
    );
    const saved = JSON.parse(store["studio:artifacts-pins"]);
    expect(saved).toEqual(["file-1"]);
  });

  it("toggles sort direction and persists", () => {
    const { result } = renderHook(() => useArtifactPins());

    act(() => result.current.toggleSort());
    expect(result.current.sortDir).toBe("oldest");
    expect(store["studio:artifacts-sort"]).toBe("oldest");

    act(() => result.current.toggleSort());
    expect(result.current.sortDir).toBe("newest");
  });

  it("hydrates from localStorage", () => {
    store["studio:artifacts-pins"] = JSON.stringify(["x", "y"]);
    store["studio:artifacts-sort"] = "oldest";

    const { result } = renderHook(() => useArtifactPins());
    // After hydration effect
    expect(result.current.pins.has("x")).toBe(true);
    expect(result.current.pins.has("y")).toBe(true);
    expect(result.current.sortDir).toBe("oldest");
  });
});
