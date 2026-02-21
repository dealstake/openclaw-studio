import { describe, expect, it, vi, beforeEach, type Mock } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useProjects } from "@/features/projects/hooks/useProjects";
import { TOGGLE_MAP } from "@/features/projects/lib/constants";
import type { ProjectEntry } from "@/features/projects/components/ProjectsPanel";

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock useVisibilityRefresh (noop — we test polling indirectly)
vi.mock("@/hooks/useVisibilityRefresh", () => ({
  useVisibilityRefresh: vi.fn(),
}));

// Mock cronJobs (avoid real RPC calls)
vi.mock("@/features/projects/lib/cronJobs", () => ({
  manageProjectCronJobs: vi.fn().mockResolvedValue(undefined),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<ProjectEntry> = {}): ProjectEntry {
  return {
    name: "Test Project",
    doc: "test-project.md",
    status: "🔨 Active",
    statusEmoji: "🔨",
    priority: "🟢 P2",
    priorityEmoji: "🟢",
    oneLiner: "A test project",
    ...overrides,
  };
}

function mockFetchSuccess(projects: ProjectEntry[]) {
  (global.fetch as Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ projects }),
  });
}

function mockFetchError(status = 500) {
  (global.fetch as Mock).mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error: "Server error" }),
  });
}

function mockFetch404() {
  (global.fetch as Mock).mockResolvedValueOnce({
    ok: false,
    status: 404,
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useProjects", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    global.fetch = vi.fn();
  });

  // ─── loadProjects ────────────────────────────────────────────────────────

  describe("loadProjects", () => {
    it("loads projects on mount when agentId is provided", async () => {
      const p = makeProject();
      mockFetchSuccess([p]);

      const { result } = renderHook(() => useProjects("agent-1", null));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.projects).toHaveLength(1);
        expect(result.current.projects[0].name).toBe("Test Project");
      });
    });

    it("does not load when agentId is null", async () => {
      const { result } = renderHook(() => useProjects(null, null));

      // Give it a tick
      await act(async () => {});

      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.current.projects).toHaveLength(0);
    });

    it("sets empty projects on 404", async () => {
      mockFetch404();

      const { result } = renderHook(() => useProjects("agent-1", null));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.projects).toHaveLength(0);
        expect(result.current.error).toBeNull();
      });
    });

    it("sets error on fetch failure", async () => {
      mockFetchError(500);

      const { result } = renderHook(() => useProjects("agent-1", null));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toContain("500");
      });
    });
  });

  // ─── toggleStatus ────────────────────────────────────────────────────────

  describe("toggleStatus", () => {
    it("toggles Active → Parked via TOGGLE_MAP", async () => {
      const p = makeProject({ statusEmoji: "🔨" });
      mockFetchSuccess([p]);

      const { result } = renderHook(() => useProjects("agent-1", null));

      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      // Mock the PATCH call + subsequent reload
      (global.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      mockFetchSuccess([{ ...p, status: "⏸️ Parked", statusEmoji: "⏸️" }]);

      await act(async () => {
        await result.current.toggleStatus(result.current.projects[0]);
      });

      // Optimistic update should apply immediately
      expect(TOGGLE_MAP["🔨"]).toEqual({ emoji: "⏸️", label: "Parked" });
    });

    it("no-ops for statuses not in TOGGLE_MAP (e.g. ✅)", async () => {
      const p = makeProject({ statusEmoji: "✅" });
      mockFetchSuccess([p]);

      const { result } = renderHook(() => useProjects("agent-1", null));
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      const fetchCountBefore = (global.fetch as Mock).mock.calls.length;

      await act(async () => {
        await result.current.toggleStatus(result.current.projects[0]);
      });

      // No additional fetch should have been made (no PATCH)
      expect((global.fetch as Mock).mock.calls.length).toBe(fetchCountBefore);
    });
  });

  // ─── changeStatus ────────────────────────────────────────────────────────

  describe("changeStatus", () => {
    it("no-ops when emoji is unchanged", async () => {
      const p = makeProject({ statusEmoji: "🔨" });
      mockFetchSuccess([p]);

      const { result } = renderHook(() => useProjects("agent-1", null));
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      const fetchCountBefore = (global.fetch as Mock).mock.calls.length;

      await act(async () => {
        await result.current.changeStatus(result.current.projects[0], "🔨", "Active");
      });

      expect((global.fetch as Mock).mock.calls.length).toBe(fetchCountBefore);
    });

    it("applies status change and reloads on success", async () => {
      const p = makeProject({ statusEmoji: "🔨" });
      mockFetchSuccess([p]);

      const { result } = renderHook(() => useProjects("agent-1", null));
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      // PATCH success + reload
      (global.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      mockFetchSuccess([{ ...p, status: "📋 Defined", statusEmoji: "📋" }]);

      await act(async () => {
        await result.current.changeStatus(result.current.projects[0], "📋", "Defined");
      });

      await waitFor(() => {
        expect(result.current.projects[0].statusEmoji).toBe("📋");
      });
    });

    it("rolls back on PATCH failure", async () => {
      const p = makeProject({ statusEmoji: "🔨" });
      mockFetchSuccess([p]);

      const { result } = renderHook(() => useProjects("agent-1", null));
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      // PATCH fails
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Forbidden" }),
      });

      await act(async () => {
        await result.current.changeStatus(result.current.projects[0], "📋", "Defined");
      });

      // Should roll back to original
      await waitFor(() => {
        expect(result.current.projects[0].statusEmoji).toBe("🔨");
      });
    });
  });

  // ─── archive ─────────────────────────────────────────────────────────────

  describe("archive", () => {
    it("optimistically removes project and reloads", async () => {
      const p = makeProject();
      mockFetchSuccess([p]);

      const { result } = renderHook(() => useProjects("agent-1", null));
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      // DELETE success + reload (empty now)
      (global.fetch as Mock).mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      mockFetchSuccess([]);

      await act(async () => {
        await result.current.archive(result.current.projects[0]);
      });

      await waitFor(() => {
        expect(result.current.projects).toHaveLength(0);
      });
    });

    it("rolls back on archive failure", async () => {
      const p = makeProject();
      mockFetchSuccess([p]);

      const { result } = renderHook(() => useProjects("agent-1", null));
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      // DELETE fails
      (global.fetch as Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Forbidden" }),
      });

      await act(async () => {
        await result.current.archive(result.current.projects[0]);
      });

      // Should roll back
      await waitFor(() => {
        expect(result.current.projects).toHaveLength(1);
      });
    });
  });

  // ─── getQueuePosition ───────────────────────────────────────────────────

  describe("getQueuePosition", () => {
    it("returns 0 when only one building project", async () => {
      const p = makeProject({ doc: "a.md", statusEmoji: "🚧" });
      mockFetchSuccess([p]);

      const { result } = renderHook(() => useProjects("agent-1", null));
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      expect(result.current.getQueuePosition("a.md")).toBe(0);
    });

    it("returns correct position for multiple building projects", async () => {
      const p1 = makeProject({ doc: "a.md", name: "A", statusEmoji: "🚧" });
      const p2 = makeProject({ doc: "b.md", name: "B", statusEmoji: "🚧" });
      const p3 = makeProject({ doc: "c.md", name: "C", statusEmoji: "🚧" });
      mockFetchSuccess([p1, p2, p3]);

      const { result } = renderHook(() => useProjects("agent-1", null));
      await waitFor(() => expect(result.current.projects).toHaveLength(3));

      expect(result.current.buildingCount).toBe(3);
      expect(result.current.getQueuePosition("a.md")).toBe(0); // first = actively building
      expect(result.current.getQueuePosition("b.md")).toBe(1);
      expect(result.current.getQueuePosition("c.md")).toBe(2);
    });

    it("returns 0 for non-building projects", async () => {
      const p1 = makeProject({ doc: "a.md", statusEmoji: "🔨" });
      mockFetchSuccess([p1]);

      const { result } = renderHook(() => useProjects("agent-1", null));
      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      expect(result.current.getQueuePosition("a.md")).toBe(0);
    });
  });

  // ─── eventTick refresh ──────────────────────────────────────────────────

  describe("eventTick refresh", () => {
    it("reloads when eventTick increments", async () => {
      const p = makeProject();
      mockFetchSuccess([p]);

      const { result, rerender } = renderHook(
        ({ tick }: { tick: number }) => useProjects("agent-1", null, { eventTick: tick }),
        { initialProps: { tick: 0 } },
      );

      await waitFor(() => expect(result.current.projects).toHaveLength(1));

      // Queue another response for the reload
      mockFetchSuccess([p, makeProject({ doc: "b.md", name: "B" })]);

      rerender({ tick: 1 });

      await waitFor(() => {
        expect(result.current.projects).toHaveLength(2);
      });
    });
  });
});
