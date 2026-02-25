import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTranscripts, useTranscriptSearch } from "@/features/sessions/hooks/useTranscripts";

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makeTranscriptList(count: number, hasMore = false) {
  const transcripts = Array.from({ length: count }, (_, i) => ({
    sessionId: `session-${i}`,
    sessionKey: `agent:alex:session-${i}`,
    archived: i % 2 === 0,
    size: 1000 + i * 100,
    startedAt: new Date(Date.now() - i * 3600_000).toISOString(),
    updatedAt: new Date(Date.now() - i * 1800_000).toISOString(),
    model: "claude-opus-4",
    preview: `Preview text for session ${i}`,
  }));
  return { transcripts, hasMore, count: count + (hasMore ? 10 : 0) };
}

describe("useTranscripts", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("loads first page on mount with agentId", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeTranscriptList(3)),
    });

    const { result } = renderHook(() => useTranscripts("alex"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.transcripts).toHaveLength(3);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.totalCount).toBe(3);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("agentId=alex");
    expect(url).toContain("page=1");
  });

  it("does not fetch without agentId", async () => {
    const { result } = renderHook(() => useTranscripts(null));

    // Give it a tick
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.transcripts).toHaveLength(0);
  });

  it("loads more pages via loadMore", async () => {
    // First page
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeTranscriptList(5, true)),
    });

    const { result } = renderHook(() => useTranscripts("alex"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasMore).toBe(true);
    expect(result.current.transcripts).toHaveLength(5);

    // Second page
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeTranscriptList(3, false)),
    });

    await act(() => {
      result.current.loadMore();
      return new Promise((r) => setTimeout(r, 50));
    });

    await waitFor(() => expect(result.current.loadingMore).toBe(false));
    expect(result.current.transcripts).toHaveLength(8); // 5 + 3
    expect(result.current.hasMore).toBe(false);
  });

  it("does not loadMore when hasMore is false", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeTranscriptList(2, false)),
    });

    const { result } = renderHook(() => useTranscripts("alex"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.loadMore());
    // Only the initial fetch
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("refresh resets to first page", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeTranscriptList(5, true)),
    });

    const { result } = renderHook(() => useTranscripts("alex"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(makeTranscriptList(2, false)),
    });

    await act(() => {
      result.current.refresh();
      return new Promise((r) => setTimeout(r, 50));
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    // After refresh, should have the fresh page 1 data
    expect(result.current.transcripts).toHaveLength(2);
  });

  it("handles fetch error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Internal Server Error" }),
    });

    const { result } = renderHook(() => useTranscripts("alex"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Internal Server Error");
    expect(result.current.transcripts).toHaveLength(0);
  });
});

describe("useTranscriptSearch", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces search queries", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [{ sessionId: "s1", matches: [] }] }),
    });

    const { result } = renderHook(() => useTranscriptSearch("alex"));

    act(() => result.current.setQuery("hel"));
    act(() => result.current.setQuery("hello"));

    // Not yet fired
    expect(mockFetch).not.toHaveBeenCalled();

    // Advance past debounce (400ms)
    await act(() => vi.advanceTimersByTimeAsync(450));

    await waitFor(() => expect(result.current.searching).toBe(false));
    // Only one fetch for the final query
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("query=hello");
  });

  it("clears results when query is empty", async () => {
    const { result } = renderHook(() => useTranscriptSearch("alex"));

    act(() => result.current.setQuery(""));
    await act(() => vi.advanceTimersByTimeAsync(450));

    expect(result.current.results).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("clearSearch resets state", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results: [{ sessionId: "s1", matches: [] }] }),
    });

    const { result } = renderHook(() => useTranscriptSearch("alex"));

    act(() => result.current.setQuery("test"));
    await act(() => vi.advanceTimersByTimeAsync(450));
    await waitFor(() => expect(result.current.searching).toBe(false));

    act(() => result.current.clearSearch());
    expect(result.current.query).toBe("");
    expect(result.current.results).toHaveLength(0);
    expect(result.current.error).toBeNull();
  });

  it("handles search error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Search engine down" }),
    });

    const { result } = renderHook(() => useTranscriptSearch("alex"));

    act(() => result.current.setQuery("test"));
    await act(() => vi.advanceTimersByTimeAsync(450));
    await waitFor(() => expect(result.current.searching).toBe(false));

    expect(result.current.error).toBe("Search engine down");
  });

  it("does not search without agentId", async () => {
    const { result } = renderHook(() => useTranscriptSearch(null));

    act(() => result.current.setQuery("test"));
    await act(() => vi.advanceTimersByTimeAsync(450));

    expect(mockFetch).not.toHaveBeenCalled();
    expect(result.current.results).toHaveLength(0);
  });
});
