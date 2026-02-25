import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// ─── useListNavigation ───────────────────────────────────────────────────────

describe("useListNavigation", () => {
  // We need to import after vitest setup
  let useListNavigation: typeof import("@/features/workspace/hooks/useListNavigation").useListNavigation;

  beforeEach(async () => {
    ({ useListNavigation } = await import(
      "@/features/workspace/hooks/useListNavigation"
    ));
  });

  const makeKeyEvent = (key: string) =>
    ({
      key,
      preventDefault: vi.fn(),
    }) as unknown as React.KeyboardEvent;

  it("initializes with activeIndex -1", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListNavigation(5, onActivate));
    expect(result.current.activeIndex).toBe(-1);
  });

  it("ArrowDown moves from -1 to 0", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListNavigation(5, onActivate));
    act(() => {
      result.current.handleKeyDown(makeKeyEvent("ArrowDown"));
    });
    expect(result.current.activeIndex).toBe(0);
  });

  it("ArrowDown wraps around at end", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListNavigation(3, onActivate));

    // Move to index 2 (last)
    act(() => result.current.handleKeyDown(makeKeyEvent("ArrowDown"))); // 0
    act(() => result.current.handleKeyDown(makeKeyEvent("ArrowDown"))); // 1
    act(() => result.current.handleKeyDown(makeKeyEvent("ArrowDown"))); // 2
    act(() => result.current.handleKeyDown(makeKeyEvent("ArrowDown"))); // wraps to 0
    expect(result.current.activeIndex).toBe(0);
  });

  it("ArrowUp wraps around at beginning", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListNavigation(3, onActivate));
    // From -1, ArrowUp should go to last item (2)
    act(() => result.current.handleKeyDown(makeKeyEvent("ArrowUp")));
    expect(result.current.activeIndex).toBe(2);
  });

  it("Home goes to first item", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListNavigation(5, onActivate));
    act(() => result.current.handleKeyDown(makeKeyEvent("ArrowDown"))); // 0
    act(() => result.current.handleKeyDown(makeKeyEvent("ArrowDown"))); // 1
    act(() => result.current.handleKeyDown(makeKeyEvent("Home")));
    expect(result.current.activeIndex).toBe(0);
  });

  it("End goes to last item", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListNavigation(5, onActivate));
    act(() => result.current.handleKeyDown(makeKeyEvent("End")));
    expect(result.current.activeIndex).toBe(4);
  });

  it("Enter activates current item", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListNavigation(5, onActivate));
    act(() => result.current.handleKeyDown(makeKeyEvent("ArrowDown"))); // 0
    act(() => result.current.handleKeyDown(makeKeyEvent("Enter")));
    expect(onActivate).toHaveBeenCalledWith(0);
  });

  it("Space activates current item", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListNavigation(5, onActivate));
    act(() => result.current.handleKeyDown(makeKeyEvent("ArrowDown"))); // 0
    act(() => result.current.handleKeyDown(makeKeyEvent("ArrowDown"))); // 1
    act(() => result.current.handleKeyDown(makeKeyEvent(" ")));
    expect(onActivate).toHaveBeenCalledWith(1);
  });

  it("Enter does nothing when activeIndex is -1", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListNavigation(5, onActivate));
    act(() => result.current.handleKeyDown(makeKeyEvent("Enter")));
    expect(onActivate).not.toHaveBeenCalled();
  });

  it("does nothing when itemCount is 0", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListNavigation(0, onActivate));
    act(() => result.current.handleKeyDown(makeKeyEvent("ArrowDown")));
    expect(result.current.activeIndex).toBe(-1);
  });

  it("ignores unrelated keys", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListNavigation(5, onActivate));
    const event = makeKeyEvent("Tab");
    act(() => result.current.handleKeyDown(event));
    expect(result.current.activeIndex).toBe(-1);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("setActiveIndex allows manual control", () => {
    const onActivate = vi.fn();
    const { result } = renderHook(() => useListNavigation(5, onActivate));
    act(() => result.current.setActiveIndex(3));
    expect(result.current.activeIndex).toBe(3);
  });
});

// ─── useWorkspaceHealth ──────────────────────────────────────────────────────

describe("useWorkspaceHealth", () => {
  let useWorkspaceHealth: typeof import("@/features/workspace/hooks/useWorkspaceHealth").useWorkspaceHealth;

  beforeEach(async () => {
    vi.useFakeTimers();
    ({ useWorkspaceHealth } = await import(
      "@/features/workspace/hooks/useWorkspaceHealth"
    ));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns null health initially", () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ configured: true, healthy: true, mode: "local" }), { status: 200 })
    );
    const { result } = renderHook(() => useWorkspaceHealth(60_000));
    expect(result.current.health).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("fetches health on mount", async () => {
    const healthData = { configured: true, healthy: true, mode: "local" as const };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(healthData), { status: 200 })
    );

    const { result } = renderHook(() => useWorkspaceHealth(60_000));

    // Flush the setTimeout(0) initial check
    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(globalThis.fetch).toHaveBeenCalledWith("/api/workspace/health");
    expect(result.current.health).toEqual(healthData);
    expect(result.current.error).toBeNull();
  });

  it("sets error on fetch failure", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useWorkspaceHealth(60_000));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.health).toEqual({
      configured: true,
      healthy: false,
      mode: "sidecar",
    });
    expect(result.current.error).toBe("Network error");
  });

  it("sets unhealthy on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 500 })
    );

    const { result } = renderHook(() => useWorkspaceHealth(60_000));

    await act(async () => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current.health?.healthy).toBe(false);
    expect(result.current.error).toBe("Health check returned 500");
  });

  it("polls at interval", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ configured: true, healthy: true, mode: "local" }), { status: 200 })
    );

    renderHook(() => useWorkspaceHealth(5000));

    // Initial check
    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);

    // After interval
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});

// ─── useProjectStatuses ──────────────────────────────────────────────────────

describe("useProjectStatuses", () => {
  let useProjectStatuses: typeof import("@/features/workspace/hooks/useProjectStatuses").useProjectStatuses;

  beforeEach(async () => {
    ({ useProjectStatuses } = await import(
      "@/features/workspace/hooks/useProjectStatuses"
    ));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty map when disabled", () => {
    const { result } = renderHook(() => useProjectStatuses("agent-1", false));
    expect(result.current.size).toBe(0);
  });

  it("returns empty map when agentId is null", () => {
    const { result } = renderHook(() => useProjectStatuses(null, true));
    expect(result.current.size).toBe(0);
  });

  it("fetches and maps project statuses", async () => {
    const mockProjects = {
      projects: [
        { doc: "my-project.md", statusEmoji: "🔨" },
        { doc: "Other-Project.md", statusEmoji: "🚧" },
      ],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockProjects), { status: 200 })
    );

    const { result } = renderHook(() => useProjectStatuses("agent-1", true));

    // Wait for async effect
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.size).toBe(2);
    expect(result.current.get("my-project.md")).toEqual({
      emoji: "🔨",
      label: "Active",
      color: "text-green-300",
    });
    expect(result.current.get("other-project.md")).toEqual({
      emoji: "🚧",
      label: "Building",
      color: "text-purple-300",
    });
  });

  it("returns empty map on fetch error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("fail"));

    const { result } = renderHook(() => useProjectStatuses("agent-1", true));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.size).toBe(0);
  });

  it("returns empty map on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 404 })
    );

    const { result } = renderHook(() => useProjectStatuses("agent-1", true));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.size).toBe(0);
  });

  it("ignores unknown status emojis", async () => {
    const mockProjects = {
      projects: [
        { doc: "test.md", statusEmoji: "🎉" }, // unknown
      ],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockProjects), { status: 200 })
    );

    const { result } = renderHook(() => useProjectStatuses("agent-1", true));

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(result.current.size).toBe(0);
  });
});
