import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWorkspaceBatchFiles } from "@/features/workspace/hooks/useWorkspaceBatchFiles";

describe("useWorkspaceBatchFiles", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns empty files initially", () => {
    const { result } = renderHook(() => useWorkspaceBatchFiles("agent1"));
    expect(result.current.files).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("fetches batch files successfully", async () => {
    const mockFiles = [
      { path: "a.md", content: "hello" },
      { path: "b.md", content: null },
    ];
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ files: mockFiles }),
    });

    const { result } = renderHook(() => useWorkspaceBatchFiles("agent1"));

    let returned: unknown;
    await act(async () => {
      returned = await result.current.fetchBatch.current(["a.md", "b.md"]);
    });

    expect(returned).toEqual(mockFiles);
    expect(result.current.files).toEqual(mockFiles);
    expect(result.current.error).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/workspace/files/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: "agent1", paths: ["a.md", "b.md"] }),
    });
  });

  it("handles HTTP errors", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: "Server error" }),
    });

    const { result } = renderHook(() => useWorkspaceBatchFiles("agent1"));

    await act(async () => {
      await result.current.fetchBatch.current(["a.md"]);
    });

    expect(result.current.error).toBe("Server error");
    expect(result.current.files).toEqual([]);
  });

  it("handles network errors", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network failure"),
    );

    const { result } = renderHook(() => useWorkspaceBatchFiles("agent1"));

    await act(async () => {
      await result.current.fetchBatch.current(["a.md"]);
    });

    expect(result.current.error).toBe("Network failure");
  });

  it("returns empty for null agentId", async () => {
    const { result } = renderHook(() => useWorkspaceBatchFiles(null));

    let returned: unknown;
    await act(async () => {
      returned = await result.current.fetchBatch.current(["a.md"]);
    });

    expect(returned).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns empty for empty paths", async () => {
    const { result } = renderHook(() => useWorkspaceBatchFiles("agent1"));

    let returned: unknown;
    await act(async () => {
      returned = await result.current.fetchBatch.current([]);
    });

    expect(returned).toEqual([]);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
