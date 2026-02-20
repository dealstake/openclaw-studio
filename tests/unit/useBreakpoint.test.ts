import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// We need to mock matchMedia before importing the hook
let matchMediaListeners: Map<string, ((e: MediaQueryListEvent) => void)[]>;
let matchMediaResults: Map<string, boolean>;

function createMockMatchMedia() {
  matchMediaListeners = new Map();
  matchMediaResults = new Map([
    ["(min-width: 1440px)", false],
    ["(min-width: 1024px)", false],
    ["(min-width: 768px)", false],
  ]);

  return vi.fn((query: string) => {
    const listeners: ((e: MediaQueryListEvent) => void)[] = [];
    matchMediaListeners.set(query, listeners);
    return {
      matches: matchMediaResults.get(query) ?? false,
      media: query,
      addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
        listeners.push(cb);
      },
      removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
        const idx = listeners.indexOf(cb);
        if (idx >= 0) listeners.splice(idx, 1);
      },
    };
  });
}

function setViewport(width: number) {
  matchMediaResults.set("(min-width: 1440px)", width >= 1440);
  matchMediaResults.set("(min-width: 1024px)", width >= 1024);
  matchMediaResults.set("(min-width: 768px)", width >= 768);
}

function fireChange() {
  for (const [query, listeners] of matchMediaListeners) {
    for (const cb of listeners) {
      cb({ matches: matchMediaResults.get(query) ?? false } as MediaQueryListEvent);
    }
  }
}

describe("useBreakpoint", () => {
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalMatchMedia = window.matchMedia;
    window.matchMedia = createMockMatchMedia() as unknown as typeof window.matchMedia;
    // Reset module cache to clear cachedBreakpoint
    vi.resetModules();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("returns mobile for narrow viewports", async () => {
    setViewport(390);
    const mod = await import("@/hooks/useBreakpoint");
    const { result } = renderHook(() => mod.useBreakpoint());
    expect(result.current).toBe("mobile");
  });

  it("returns tablet for 768px", async () => {
    setViewport(800);
    const mod = await import("@/hooks/useBreakpoint");
    const { result } = renderHook(() => mod.useBreakpoint());
    expect(result.current).toBe("tablet");
  });

  it("returns desktop for 1024px", async () => {
    setViewport(1200);
    const mod = await import("@/hooks/useBreakpoint");
    const { result } = renderHook(() => mod.useBreakpoint());
    expect(result.current).toBe("desktop");
  });

  it("returns wide for 1440px+", async () => {
    setViewport(1440);
    const mod = await import("@/hooks/useBreakpoint");
    const { result } = renderHook(() => mod.useBreakpoint());
    expect(result.current).toBe("wide");
  });

  it("helper isMobile works", async () => {
    const { isMobile } = await import("@/hooks/useBreakpoint");
    expect(isMobile("mobile")).toBe(true);
    expect(isMobile("tablet")).toBe(false);
  });

  it("helper isDesktopOrAbove works", async () => {
    const { isDesktopOrAbove } = await import("@/hooks/useBreakpoint");
    expect(isDesktopOrAbove("mobile")).toBe(false);
    expect(isDesktopOrAbove("tablet")).toBe(false);
    expect(isDesktopOrAbove("desktop")).toBe(true);
    expect(isDesktopOrAbove("wide")).toBe(true);
  });

  it("helper isWide works", async () => {
    const { isWide } = await import("@/hooks/useBreakpoint");
    expect(isWide("wide")).toBe(true);
    expect(isWide("desktop")).toBe(false);
  });

  it("responds to viewport changes", async () => {
    setViewport(1440);
    const mod = await import("@/hooks/useBreakpoint");
    const { result } = renderHook(() => mod.useBreakpoint());
    expect(result.current).toBe("wide");

    act(() => {
      setViewport(800);
      fireChange();
    });
    expect(result.current).toBe("tablet");
  });
});
