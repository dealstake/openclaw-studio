import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useActivityHistory } from "@/features/activity/hooks/useActivityHistory";
import type { ActivityEvent } from "@/features/activity/lib/activityTypes";

// Mock the agent store
vi.mock("@/features/agents/state/store", () => ({
  useAgentStore: () => ({
    state: { selectedAgentId: "test-agent" },
  }),
}));

function makeEvent(id: string): ActivityEvent {
  return {
    id,
    timestamp: new Date().toISOString(),
    type: "cron",
    taskName: `Task ${id}`,
    taskId: `task-${id}`,
    projectSlug: null,
    projectName: null,
    status: "success",
    summary: `Summary ${id}`,
    meta: {},
  };
}

describe("useActivityHistory", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads events on mount", async () => {
    const events = [makeEvent("1"), makeEvent("2")];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events, total: 2 }),
    });

    const { result } = renderHook(() => useActivityHistory());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toHaveLength(2);
    expect(result.current.total).toBe(2);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sets error on fetch failure", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const { result } = renderHook(() => useActivityHistory());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("HTTP 500");
    expect(result.current.events).toHaveLength(0);
  });

  it("sets error on network failure", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const { result } = renderHook(() => useActivityHistory());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Network error");
  });

  it("supports loadMore pagination", async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => makeEvent(`p1-${i}`));
    const page2 = [makeEvent("p2-0"), makeEvent("p2-1")];

    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ events: page1, total: 52 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ events: page2, total: 52 }),
      });
    });

    const { result } = renderHook(() => useActivityHistory());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toHaveLength(50);
    expect(result.current.hasMore).toBe(true);

    act(() => {
      result.current.loadMore();
    });

    await waitFor(() => expect(result.current.events).toHaveLength(52));
    expect(result.current.hasMore).toBe(false);
  });

  it("refresh resets to first page", async () => {
    const events = [makeEvent("1")];
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ events, total: 1 }),
    });

    const { result } = renderHook(() => useActivityHistory());

    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
