import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSessionTrace } from "@/features/sessions/hooks/useSessionTrace";

describe("useSessionTrace", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns initial empty state", () => {
    const { result } = renderHook(() => useSessionTrace("alex", "main"));
    expect(result.current.turns).toEqual([]);
    expect(result.current.summary).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.selectedTurnIndex).toBeNull();
  });

  it("does not load without agentId", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { result } = renderHook(() => useSessionTrace(null, "main"));
    await act(async () => {
      await result.current.load();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("does not load without sessionId", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const { result } = renderHook(() => useSessionTrace("alex", null));
    await act(async () => {
      await result.current.load();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("loads trace data successfully", async () => {
    const mockMessages = [
      { role: "user", content: "Hello", timestamp: "2026-01-01T00:00:00Z" },
      { role: "assistant", content: "Hi there!", timestamp: "2026-01-01T00:00:01Z", usage: { input_tokens: 10, output_tokens: 5 } },
    ];

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        sessionId: "main",
        messages: mockMessages,
        total: 2,
        offset: 0,
        limit: 500,
        hasMore: false,
      }),
    } as Response);

    const { result } = renderHook(() => useSessionTrace("alex", "main"));
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.turns.length).toBeGreaterThan(0);
    expect(result.current.summary).not.toBeNull();
    expect(result.current.selectedTurnIndex).toBe(0);
  });

  it("handles fetch error", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Internal Server Error" }),
    } as Response);

    const { result } = renderHook(() => useSessionTrace("alex", "main"));
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBe("Internal Server Error");
    expect(result.current.turns).toEqual([]);
  });

  it("handles network error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network failure"));

    const { result } = renderHook(() => useSessionTrace("alex", "main"));
    await act(async () => {
      await result.current.load();
    });

    expect(result.current.error).toBe("Network failure");
  });

  it("allows selecting a turn index", () => {
    const { result } = renderHook(() => useSessionTrace("alex", "main"));
    act(() => {
      result.current.setSelectedTurnIndex(3);
    });
    expect(result.current.selectedTurnIndex).toBe(3);
  });
});
