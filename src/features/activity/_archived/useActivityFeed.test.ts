import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useActivityFeed } from "@/features/activity/hooks/useActivityFeed";
import type { ActivityEvent } from "@/features/activity/lib/activityTypes";

const makeEvent = (id: string, timestamp: string): ActivityEvent => ({
  id,
  timestamp,
  type: "cron-completion",
  taskName: "Project Continuation",
  taskId: "task-1",
  projectSlug: "test-project",
  projectName: "Test Project",
  status: "success",
  summary: "Phase 1 complete.",
  meta: { phase: "Phase 1", filesChanged: 3, testsCount: 100 },
});

describe("useActivityFeed", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns empty state initially", () => {
    const { result } = renderHook(() => useActivityFeed(null));
    expect(result.current.events).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(false);
  });

  it("does not fetch when agentId is null", async () => {
    const { result } = renderHook(() => useActivityFeed(null));
    await act(async () => {
      result.current.refresh();
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("fetches events on refresh", async () => {
    const events = [
      makeEvent("e1", "2026-02-18T15:00:00Z"),
      makeEvent("e2", "2026-02-18T14:00:00Z"),
    ];
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events, total: 2 }),
    } as Response);

    const { result } = renderHook(() => useActivityFeed("alex"));
    await act(async () => {
      result.current.refresh();
    });

    expect(result.current.events).toHaveLength(2);
    expect(result.current.total).toBe(2);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sets error on fetch failure", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);

    const { result } = renderHook(() => useActivityFeed("alex"));
    await act(async () => {
      result.current.refresh();
    });

    expect(result.current.error).toBe("Activity API error: 500");
    expect(result.current.events).toEqual([]);
  });

  it("sets error on network failure", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useActivityFeed("alex"));
    await act(async () => {
      result.current.refresh();
    });

    expect(result.current.error).toBe("Network error");
  });

  it("paginates with loadMore", async () => {
    const page1 = Array.from({ length: 50 }, (_, i) =>
      makeEvent(`e${i}`, `2026-02-18T${String(i).padStart(2, "0")}:00:00Z`)
    );
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: page1, total: 75 }),
    } as Response);

    const { result } = renderHook(() => useActivityFeed("alex"));
    await act(async () => {
      result.current.refresh();
    });

    expect(result.current.events).toHaveLength(50);
    expect(result.current.hasMore).toBe(true);

    const page2 = Array.from({ length: 25 }, (_, i) =>
      makeEvent(`e${50 + i}`, `2026-02-17T${String(i).padStart(2, "0")}:00:00Z`)
    );
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: page2, total: 75 }),
    } as Response);

    await act(async () => {
      result.current.loadMore();
    });

    expect(result.current.events).toHaveLength(75);
    expect(result.current.hasMore).toBe(false);
  });

  it("passes filter params to fetch URL", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [], total: 0 }),
    } as Response);

    const { result } = renderHook(() =>
      useActivityFeed("alex", { status: "error" })
    );
    await act(async () => {
      result.current.refresh();
    });

    const url = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
    expect(url).toContain("agentId=alex");
    expect(url).toContain("status=error");
  });
});
