import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTranscripts, useTranscriptSearch } from "@/features/sessions/hooks/useTranscripts";

/* ─── Mock fetch ─── */
const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
});

function okJson(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
}

function errJson(error: string) {
  return Promise.resolve({
    ok: false,
    status: 500,
    json: () => Promise.resolve({ error }),
  });
}

const ENTRY = {
  sessionId: "abc",
  sessionKey: null,
  archived: false,
  size: 100,
  startedAt: null,
  updatedAt: null,
  model: null,
  preview: null,
};

/* ─── useTranscripts ─── */
describe("useTranscripts", () => {
  it("fetches first page on mount with agentId", async () => {
    mockFetch.mockReturnValue(okJson({ transcripts: [ENTRY], hasMore: false, count: 1 }));

    const { result } = renderHook(() => useTranscripts("test-agent"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.transcripts).toHaveLength(1);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.hasMore).toBe(false);
    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("agentId=test-agent");
    expect(url).toContain("page=1");
  });

  it("does not fetch when agentId is null", async () => {
    const { result } = renderHook(() => useTranscripts(null));
    // Allow microtasks to flush
    await act(async () => {
      await new Promise((r) => setTimeout(r, 50));
    });
    expect(result.current.transcripts).toEqual([]);
    expect(result.current.loading).toBe(false);
    // Only check no transcript-related calls (there might be none)
    const transcriptCalls = mockFetch.mock.calls.filter(
      (c) => (c[0] as string).includes("transcripts"),
    );
    expect(transcriptCalls).toHaveLength(0);
  });

  it("sets error on fetch failure", async () => {
    mockFetch.mockReturnValue(errJson("Server error"));

    const { result } = renderHook(() => useTranscripts("agent"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe("Server error");
    });

    expect(result.current.transcripts).toEqual([]);
  });

  it("appends transcripts on loadMore()", async () => {
    const page1 = [{ ...ENTRY, sessionId: "a" }];
    const page2 = [{ ...ENTRY, sessionId: "b" }];

    mockFetch.mockReturnValueOnce(okJson({ transcripts: page1, hasMore: true, count: 2 }));

    const { result } = renderHook(() => useTranscripts("agent"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.hasMore).toBe(true);

    mockFetch.mockReturnValueOnce(okJson({ transcripts: page2, hasMore: false, count: 2 }));
    act(() => result.current.loadMore());

    await waitFor(() => {
      expect(result.current.transcripts).toHaveLength(2);
      expect(result.current.transcripts[1].sessionId).toBe("b");
    });
  });

  it("refresh resets to page 1", async () => {
    mockFetch.mockReturnValueOnce(okJson({ transcripts: [], hasMore: false, count: 0 }));

    const { result } = renderHook(() => useTranscripts("agent"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockFetch.mockReturnValueOnce(
      okJson({ transcripts: [{ ...ENTRY, sessionId: "refreshed" }], hasMore: false, count: 1 }),
    );
    act(() => result.current.refresh());

    await waitFor(() => {
      expect(result.current.transcripts).toHaveLength(1);
      expect(result.current.transcripts[0].sessionId).toBe("refreshed");
    });
  });
});

/* ─── useTranscriptSearch ─── */
describe("useTranscriptSearch", () => {
  it("starts with empty state", () => {
    const { result } = renderHook(() => useTranscriptSearch("agent"));
    expect(result.current.query).toBe("");
    expect(result.current.results).toEqual([]);
    expect(result.current.searching).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("searches after debounce when query is set", async () => {
    const searchResult = {
      sessionId: "x",
      sessionKey: null,
      archived: false,
      startedAt: null,
      updatedAt: null,
      matches: [{ role: "user", timestamp: null, snippet: "hello" }],
    };
    mockFetch.mockReturnValue(okJson({ results: [searchResult] }));

    const { result } = renderHook(() => useTranscriptSearch("agent"));

    act(() => result.current.setQuery("test"));

    await waitFor(
      () => {
        expect(result.current.results).toHaveLength(1);
      },
      { timeout: 2000 },
    );

    // Verify a search call was made with query param
    const searchCalls = mockFetch.mock.calls.filter((c) =>
      (c[0] as string).includes("query=test"),
    );
    expect(searchCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("clearSearch resets state", async () => {
    mockFetch.mockReturnValue(
      okJson({
        results: [
          { sessionId: "x", sessionKey: null, archived: false, startedAt: null, updatedAt: null, matches: [] },
        ],
      }),
    );

    const { result } = renderHook(() => useTranscriptSearch("agent"));

    act(() => result.current.setQuery("test"));
    await waitFor(() => expect(result.current.results.length).toBeGreaterThan(0), { timeout: 2000 });

    act(() => result.current.clearSearch());

    expect(result.current.query).toBe("");
    expect(result.current.results).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
