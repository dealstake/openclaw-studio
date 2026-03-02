import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useAppLayout } from "@/hooks/useAppLayout";

// Mock useBreakpoint
let mockBreakpoint = "wide" as "mobile" | "tablet" | "desktop" | "wide";
vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpoint: () => mockBreakpoint,
  isDesktopOrAbove: (bp: string) => bp === "desktop" || bp === "wide",
  isWide: (bp: string) => bp === "wide",
  isTablet: (bp: string) => bp === "tablet",
  isMobile: (bp: string) => bp === "mobile",
  isTabletOrBelow: (bp: string) => bp === "mobile" || bp === "tablet",
}));

// Mock useSwipeDrawer
vi.mock("@/hooks/useSwipeDrawer", () => ({
  useSwipeDrawer: () => ({}),
}));

// Mock useAutoHideHeader
vi.mock("@/hooks/useAutoHideHeader", () => ({
  useAutoHideHeader: () => ({
    isVisible: true,
    onHoverZoneEnter: vi.fn(),
    onHoverZoneLeave: vi.fn(),
  }),
}));

// Mock localStorage
const localStorageMap = new Map<string, string>();
beforeEach(() => {
  localStorageMap.clear();
  vi.spyOn(Storage.prototype, "getItem").mockImplementation((key) => localStorageMap.get(key) ?? null);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation((key, value) => {
    localStorageMap.set(key, value);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  mockBreakpoint = "wide";
});

describe("useAppLayout", () => {
  it("returns initial state with defaults", () => {
    const { result } = renderHook(() => useAppLayout());
    expect(result.current.mobilePane).toBe("chat");
    expect(result.current.contextPanelOpen).toBe(true);
    expect(result.current.sessionSidebarCollapsed).toBe(false);
    expect(result.current.expandedTab).toBeNull();
    expect(result.current.managementView).toBeNull();
    expect(result.current.brainFileTab).toBe("AGENTS.md");
    expect(result.current.brainPreviewMode).toBe(true);
  });

  it("computes showSidebarInline based on breakpoint", () => {
    mockBreakpoint = "wide";
    const { result: wide } = renderHook(() => useAppLayout());
    expect(wide.current.showSidebarInline).toBe(true);

    cleanup();
    mockBreakpoint = "mobile";
    const { result: mobile } = renderHook(() => useAppLayout());
    expect(mobile.current.showSidebarInline).toBe(false);
  });

  it("computes showContextInline when wide and panel open", () => {
    mockBreakpoint = "wide";
    const { result } = renderHook(() => useAppLayout());
    expect(result.current.showContextInline).toBe(true);
  });

  it("showContextInline is false when panel closed", () => {
    mockBreakpoint = "wide";
    const { result } = renderHook(() => useAppLayout());
    act(() => result.current.setContextPanelOpen(false));
    expect(result.current.showContextInline).toBe(false);
  });

  it("updates sessionSidebarCollapsed state", () => {
    const { result } = renderHook(() => useAppLayout());
    expect(result.current.sessionSidebarCollapsed).toBe(false);
    act(() => result.current.setSessionSidebarCollapsed(true));
    expect(result.current.sessionSidebarCollapsed).toBe(true);
  });

  it("updates contextPanelOpen state", () => {
    const { result } = renderHook(() => useAppLayout());
    const initial = result.current.contextPanelOpen;
    act(() => result.current.setContextPanelOpen(!initial));
    expect(result.current.contextPanelOpen).toBe(!initial);
  });

  it("handleExpandToggle sets expandedTab from contextTab", () => {
    const { result } = renderHook(() => useAppLayout());
    act(() => result.current.setContextTab("tasks"));
    act(() => result.current.handleExpandToggle());
    expect(result.current.expandedTab).toBe("tasks");
  });

  it("handleExpandToggle toggles off when already expanded", () => {
    const { result } = renderHook(() => useAppLayout());
    act(() => result.current.handleExpandToggle());
    expect(result.current.expandedTab).not.toBeNull();
    act(() => result.current.handleExpandToggle());
    expect(result.current.expandedTab).toBeNull();
  });

  it("clearExpandedTab resets to null", () => {
    const { result } = renderHook(() => useAppLayout());
    act(() => result.current.handleExpandToggle());
    expect(result.current.expandedTab).not.toBeNull();
    act(() => result.current.clearExpandedTab());
    expect(result.current.expandedTab).toBeNull();
  });

  it("switchToChat sets mobilePane to chat", () => {
    const { result } = renderHook(() => useAppLayout());
    act(() => result.current.setMobilePane("context"));
    expect(result.current.mobilePane).toBe("context");
    act(() => result.current.switchToChat());
    expect(result.current.mobilePane).toBe("chat");
  });

  it("handleFilesToggle opens workspace tab in context panel", () => {
    const { result } = renderHook(() => useAppLayout());
    act(() => result.current.handleFilesToggle());
    expect(result.current.contextTab).toBe("workspace");
    expect(result.current.contextPanelOpen).toBe(true);
    expect(result.current.mobilePane).toBe("context");
  });

  it("handleBackToChat clears managementView", () => {
    const { result } = renderHook(() => useAppLayout());
    act(() => result.current.setManagementView("usage"));
    expect(result.current.managementView).toBe("usage");
    act(() => result.current.handleBackToChat());
    expect(result.current.managementView).toBeNull();
  });

  it("reads sessionSidebarCollapsed from localStorage on init", () => {
    localStorageMap.set("studio:session-sidebar-collapsed", "true");
    const { result } = renderHook(() => useAppLayout());
    expect(result.current.sessionSidebarCollapsed).toBe(true);
  });

  it("contextPanelOpen can be toggled", () => {
    const { result } = renderHook(() => useAppLayout());
    const initial = result.current.contextPanelOpen;
    act(() => result.current.setContextPanelOpen(!initial));
    expect(result.current.contextPanelOpen).toBe(!initial);
    act(() => result.current.setContextPanelOpen(initial));
    expect(result.current.contextPanelOpen).toBe(initial);
  });

  describe("keyboard shortcuts", () => {
    it("Escape closes mobileSessionDrawer", () => {
      const { result } = renderHook(() => useAppLayout());
      act(() => result.current.setMobileSessionDrawerOpen(true));
      expect(result.current.mobileSessionDrawerOpen).toBe(true);
      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      });
      expect(result.current.mobileSessionDrawerOpen).toBe(false);
    });

    it("Cmd+\\ toggles context panel", () => {
      const { result } = renderHook(() => useAppLayout());
      const initial = result.current.contextPanelOpen;
      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "\\", metaKey: true }));
      });
      expect(result.current.contextPanelOpen).toBe(!initial);
    });

    it("Cmd+Shift+P opens projects tab", () => {
      const { result } = renderHook(() => useAppLayout());
      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "P", metaKey: true, shiftKey: true }));
      });
      expect(result.current.contextTab).toBe("projects");
      expect(result.current.contextPanelOpen).toBe(true);
    });

    it("Cmd+Shift+T opens tasks tab", () => {
      const { result } = renderHook(() => useAppLayout());
      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "T", metaKey: true, shiftKey: true }));
      });
      expect(result.current.contextTab).toBe("tasks");
    });

    it("Cmd+Shift+B opens brain tab", () => {
      const { result } = renderHook(() => useAppLayout());
      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "B", metaKey: true, shiftKey: true }));
      });
      expect(result.current.contextTab).toBe("brain");
    });

    it("Cmd+Shift+A opens activity tab", () => {
      const { result } = renderHook(() => useAppLayout());
      act(() => {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "A", metaKey: true, shiftKey: true }));
      });
      expect(result.current.contextTab).toBe("activity");
    });
  });
});

describe("breakpoint helpers (pure)", () => {
  // These are tested via the mock definitions above which mirror the real implementation
  it("isDesktopOrAbove returns true for desktop/wide", () => {
    // Verified through useAppLayout: showSidebarInline uses isDesktopOrAbove
    mockBreakpoint = "desktop";
    const { result } = renderHook(() => useAppLayout());
    expect(result.current.showSidebarInline).toBe(true);
  });

  it("tablet breakpoint gives isTabletLayout=true, isMobileLayout=false", () => {
    mockBreakpoint = "tablet";
    const { result } = renderHook(() => useAppLayout());
    expect(result.current.isTabletLayout).toBe(true);
    expect(result.current.isMobileLayout).toBe(false);
  });

  it("mobile breakpoint gives isMobileLayout=true, isTabletLayout=false", () => {
    mockBreakpoint = "mobile";
    const { result } = renderHook(() => useAppLayout());
    expect(result.current.isMobileLayout).toBe(true);
    expect(result.current.isTabletLayout).toBe(false);
  });
});
