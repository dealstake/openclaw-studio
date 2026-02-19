import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionTrace } from "@/features/sessions/hooks/useSessionTrace";

const MOCK_MESSAGES = [
  { role: "user", content: "Hello", timestamp: "2026-01-01T00:00:00Z" },
  {
    role: "assistant",
    content: "Hi there!",
    timestamp: "2026-01-01T00:00:01Z",
    usage: { input_tokens: 10, output_tokens: 20 },
    cost: 0.001,
    durationMs: 500,
  },
];

const TRACE_RESPONSE = {
  sessionId: "test-session",
  messages: MOCK_MESSAGES,
  total: 2,
  offset: 0,
  limit: 500,
  hasMore: false,
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(TRACE_RESPONSE),
    }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useSessionTrace", () => {
  it("does not load when agentId or sessionId is null", async () => {
    const { result } = renderHook(() => useSessionTrace(null, null));

    await act(async () => {
      await result.current.load();
    });

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.turns).toEqual([]);
    expect(result.current.summary).toBeNull();
  });

  it("fetches trace and parses turns", async () => {
    const { result } = renderHook(() => useSessionTrace("alex", "test-session"));

    await act(async () => {
      await result.current.load();
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/sessions/trace?"),
    );
    // parseTrace produces turns from messages — at least 1 turn expected
    expect(result.current.turns.length).toBeGreaterThanOrEqual(1);
    expect(result.current.summary).not.toBeNull();
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("sets selectedTurnIndex to 0 on first load", async () => {
    const { result } = renderHook(() => useSessionTrace("alex", "test-session"));

    expect(result.current.selectedTurnIndex).toBeNull();

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.selectedTurnIndex).toBe(0);
  });

  it("handles fetch errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: "Internal server error" }),
      }),
    );
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useSessionTrace("alex", "test-session"));

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.error).toBe("Internal server error");
    expect(result.current.turns).toEqual([]);
    expect(result.current.loading).toBe(false);
    consoleSpy.mockRestore();
  });

  it("handles network exceptions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network failure")));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { result } = renderHook(() => useSessionTrace("alex", "test-session"));

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.error).toBe("Network failure");
    expect(result.current.loading).toBe(false);
    consoleSpy.mockRestore();
  });

  it("allows setting selected turn index", async () => {
    const { result } = renderHook(() => useSessionTrace("alex", "test-session"));

    act(() => {
      result.current.setSelectedTurnIndex(3);
    });

    expect(result.current.selectedTurnIndex).toBe(3);
  });
});
