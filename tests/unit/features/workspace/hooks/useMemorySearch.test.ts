import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useMemorySearch } from "@/features/workspace/hooks/useMemorySearch";

// ── Setup ─────────────────────────────────────────────────────────────────

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  // shouldAdvanceTime: true — lets real time pass so React renders + waitFor work
  // but we can still control timer scheduling with advanceTimersByTime
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.restoreAllMocks();
  mockFetch.mockReset();
  vi.useRealTimers();
});

function mockSuccess(results = [], totalMatches = 0, filesSearched = 0) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ results, totalMatches, filesSearched }),
  } as Response);
}

function mockError(status = 500) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({}),
  } as Response);
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("useMemorySearch", () => {
  it("initializes with empty state", () => {
    const { result } = renderHook(() => useMemorySearch("agent-1"));
    expect(result.current.query).toBe("");
    expect(result.current.results).toEqual([]);
    expect(result.current.searching).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.totalMatches).toBe(0);
    expect(result.current.filesSearched).toBe(0);
  });

  it("does not call fetch when query is empty", async () => {
    const { result } = renderHook(() => useMemorySearch("agent-1"));

    act(() => {
      result.current.setQuery("  ");
    });

    vi.advanceTimersByTime(500);

    // Allow any pending microtasks
    await act(async () => {});

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
  });

  it("debounces — fires only after 300ms of inactivity", async () => {
    mockSuccess();
    const { result } = renderHook(() => useMemorySearch("agent-1"));

    act(() => {
      result.current.setQuery("hello");
    });

    // 200ms: should NOT have fired
    act(() => { vi.advanceTimersByTime(200); });
    expect(mockFetch).not.toHaveBeenCalled();

    // 100ms more (300ms total): fires
    act(() => { vi.advanceTimersByTime(100); });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  it("cancels pending debounce on rapid keystrokes, fires only once", async () => {
    mockSuccess();
    const { result } = renderHook(() => useMemorySearch("agent-1"));

    act(() => { result.current.setQuery("h"); });
    act(() => { vi.advanceTimersByTime(100); });
    act(() => { result.current.setQuery("he"); });
    act(() => { vi.advanceTimersByTime(100); });
    act(() => { result.current.setQuery("hel"); });
    act(() => { vi.advanceTimersByTime(300); });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.query).toBe("hel");
  });

  it("populates results and metadata on successful fetch", async () => {
    const mockResults = [
      {
        filePath: "memory/2026-02-27.md",
        lineNumber: 5,
        snippet: "found it here",
        matchCount: 3,
      },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ results: mockResults, totalMatches: 3, filesSearched: 2 }),
    } as Response);

    const { result } = renderHook(() => useMemorySearch("agent-1"));

    act(() => {
      result.current.setQuery("found");
    });
    act(() => { vi.advanceTimersByTime(300); });

    await waitFor(() => {
      expect(result.current.searching).toBe(false);
    });

    expect(result.current.results).toEqual(mockResults);
    expect(result.current.totalMatches).toBe(3);
    expect(result.current.filesSearched).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it("sets error message on non-ok response", async () => {
    mockError(500);
    const { result } = renderHook(() => useMemorySearch("agent-1"));

    act(() => {
      result.current.setQuery("crash");
    });
    act(() => { vi.advanceTimersByTime(300); });

    await waitFor(() => {
      expect(result.current.searching).toBe(false);
    });

    expect(result.current.error).toMatch(/500/);
    expect(result.current.results).toEqual([]);
  });

  it("clears results immediately when query is set to empty", async () => {
    const mockResults = [
      { filePath: "MEMORY.md", lineNumber: 1, snippet: "something", matchCount: 1 },
    ];
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ results: mockResults, totalMatches: 1, filesSearched: 1 }),
    } as Response);

    const { result } = renderHook(() => useMemorySearch("agent-1"));

    // Build up results
    act(() => { result.current.setQuery("something"); });
    act(() => { vi.advanceTimersByTime(300); });
    await waitFor(() => { expect(result.current.results.length).toBeGreaterThan(0); });

    // Clear — results should vanish immediately (no debounce needed for empty)
    act(() => { result.current.setQuery(""); });

    expect(result.current.results).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("does not fetch when agentId is null", async () => {
    const { result } = renderHook(() => useMemorySearch(null));

    act(() => { result.current.setQuery("test"); });
    act(() => { vi.advanceTimersByTime(300); });
    await act(async () => {});

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.results).toEqual([]);
  });

  it("sends correct POST body with agentId and query", async () => {
    mockSuccess();
    const { result } = renderHook(() => useMemorySearch("agent-abc"));

    act(() => { result.current.setQuery("deployment"); });
    act(() => { vi.advanceTimersByTime(300); });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/workspace/search");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ agentId: "agent-abc", query: "deployment" });
  });
});
