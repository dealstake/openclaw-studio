import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useProjectStatuses } from "@/features/workspace/hooks/useProjectStatuses";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const MOCK_PROJECTS = [
  { doc: "foo.md", statusEmoji: "🔨" },
  { doc: "bar.md", statusEmoji: "✅" },
  { doc: "baz.md", statusEmoji: "📋" },
  { doc: "qux.md", statusEmoji: "⏸️" },
  { doc: "backlog.md", statusEmoji: "🌊" },
];

function mockProjectsResponse(projects: Array<{ doc: string; statusEmoji: string }>) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ projects }),
  });
}

describe("useProjectStatuses", () => {
  it("returns empty map when disabled", () => {
    const { result } = renderHook(() => useProjectStatuses("agent1", false));
    expect(result.current.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty map when agentId is null", () => {
    const { result } = renderHook(() => useProjectStatuses(null, true));
    expect(result.current.size).toBe(0);
  });

  it("parses all status emojis from projects API", async () => {
    mockProjectsResponse(MOCK_PROJECTS);
    const { result } = renderHook(() => useProjectStatuses("agent1", true));

    await waitFor(() => expect(result.current.size).toBe(5));

    expect(result.current.get("foo.md")).toEqual({
      emoji: "🔨",
      label: "Active",
      color: "text-green-400",
    });
    expect(result.current.get("bar.md")).toEqual({
      emoji: "✅",
      label: "Done",
      color: "text-emerald-500",
    });
    expect(result.current.get("baz.md")).toEqual({
      emoji: "📋",
      label: "Defined",
      color: "text-amber-400",
    });
    expect(result.current.get("qux.md")).toEqual({
      emoji: "⏸️",
      label: "Parked",
      color: "text-muted-foreground",
    });
    expect(result.current.get("backlog.md")).toEqual({
      emoji: "🌊",
      label: "Backlog",
      color: "text-blue-400",
    });
  });

  it("keys are lowercase", async () => {
    mockProjectsResponse([{ doc: "MyFile.MD", statusEmoji: "🔨" }]);
    const { result } = renderHook(() => useProjectStatuses("agent1", true));
    await waitFor(() => expect(result.current.size).toBe(1));
    expect(result.current.has("myfile.md")).toBe(true);
  });

  it("returns empty map on fetch error", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));
    const { result } = renderHook(() => useProjectStatuses("agent1", true));
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.size).toBe(0);
  });

  it("returns empty map when response is not ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const { result } = renderHook(() => useProjectStatuses("agent1", true));
    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.size).toBe(0);
  });

  it("skips projects without recognized status emoji", async () => {
    mockProjectsResponse([
      { doc: "a.md", statusEmoji: "🔨" },
      { doc: "b.md", statusEmoji: "" },
    ]);
    const { result } = renderHook(() => useProjectStatuses("agent1", true));
    await waitFor(() => expect(result.current.size).toBe(1));
    expect(result.current.has("a.md")).toBe(true);
    expect(result.current.has("b.md")).toBe(false);
  });
});
