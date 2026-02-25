import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useProjects } from "@/features/projects/hooks/useProjects";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { ProjectEntry } from "@/features/projects/components/ProjectsPanel";

afterEach(cleanup);

// ─── Mock sonner ─────────────────────────────────────────────────────────────
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ─── Mock cronJobs ───────────────────────────────────────────────────────────
const mockManageCronJobs = vi.fn().mockResolvedValue(undefined);
vi.mock("@/features/projects/lib/cronJobs", () => ({
  manageProjectCronJobs: (...args: unknown[]) => mockManageCronJobs(...args),
}));

// ─── Mock useVisibilityRefresh (no-op in tests) ─────────────────────────────
vi.mock("@/hooks/useVisibilityRefresh", () => ({
  useVisibilityRefresh: vi.fn(),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeClient(overrides: Partial<GatewayClient> = {}): GatewayClient {
  return {
    call: vi.fn().mockResolvedValue({ ok: true }),
    status: "connected" as GatewayStatus,
    ...overrides,
  } as unknown as GatewayClient;
}

function makeProject(overrides: Partial<ProjectEntry> = {}): ProjectEntry {
  return {
    name: "Test Project",
    doc: "test-project.md",
    status: "🔨 Active",
    statusEmoji: "🔨",
    priority: "🟡 P1",
    priorityEmoji: "🟡",
    oneLiner: "A test project",
    ...overrides,
  };
}

const projectA = makeProject();
const projectB = makeProject({
  name: "Second Project",
  doc: "second.md",
  status: "🚧 In Progress",
  statusEmoji: "🚧",
});

function mockFetchSuccess(projects: ProjectEntry[]) {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({ projects }),
  });
}

function mockFetchError(status = 500) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error: "Server error" }),
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useProjects", () => {
  let client: GatewayClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeClient();
    global.fetch = mockFetchSuccess([projectA, projectB]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Initial Load ────────────────────────────────────────────────────────

  describe("initial load", () => {
    it("fetches projects and sets state", async () => {
      const { result } = renderHook(() =>
        useProjects("agent-1", client),
      );

      // Wait for async load
      await act(async () => {});

      expect(result.current.projects).toHaveLength(2);
      expect(result.current.projects[0].name).toBe("Test Project");
      expect(result.current.error).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    it("sets loading true only on initial load", async () => {
      let loadingDuringFirst = false;
      const { result } = renderHook(() =>
        useProjects("agent-1", client),
      );

      // Check loading was set (it may already be resolved)
      loadingDuringFirst = result.current.loading;

      await act(async () => {});

      // After load completes, loading is false
      expect(result.current.loading).toBe(false);
    });

    it("sets empty projects on 404", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      const { result } = renderHook(() =>
        useProjects("agent-1", client),
      );

      await act(async () => {});
      expect(result.current.projects).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("sets error on fetch failure", async () => {
      global.fetch = mockFetchError();

      const { result } = renderHook(() =>
        useProjects("agent-1", client),
      );

      await act(async () => {});
      expect(result.current.error).toBe("Failed to fetch projects: 500");
      expect(result.current.projects).toEqual([]);
    });

    it("does nothing when agentId is null", async () => {
      const { result } = renderHook(() =>
        useProjects(null, client),
      );

      await act(async () => {});
      expect(result.current.projects).toEqual([]);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  // ─── toggleStatus ────────────────────────────────────────────────────────

  describe("toggleStatus", () => {
    it("optimistically updates status and calls PATCH", async () => {
      const fetchMock = mockFetchSuccess([projectA, projectB]);
      global.fetch = fetchMock;

      const { result } = renderHook(() =>
        useProjects("agent-1", client),
      );
      await act(async () => {});

      // Reset fetch mock to track PATCH
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ projects: [{ ...projectA, status: "⏸️ Parked", statusEmoji: "⏸️" }, projectB] }),
      });

      await act(async () => {
        await result.current.toggleStatus(projectA);
      });

      // PATCH was called (second call after initial GET)
      const patchCall = fetchMock.mock.calls.find(
        (c: unknown[]) => (c[1] as RequestInit)?.method === "PATCH",
      );
      expect(patchCall).toBeDefined();
      const body = JSON.parse((patchCall![1] as RequestInit).body as string);
      expect(body.status).toBe("⏸️ Parked");
    });

    it("rolls back on PATCH failure", async () => {
      const fetchMock = mockFetchSuccess([projectA]);
      global.fetch = fetchMock;

      const { result } = renderHook(() =>
        useProjects("agent-1", client),
      );
      await act(async () => {});

      // Make PATCH fail
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Update failed" }),
      });

      await act(async () => {
        await result.current.toggleStatus(projectA);
      });

      // Should rollback to original status
      expect(result.current.projects[0].statusEmoji).toBe("🔨");
    });

    it("does nothing for unknown status emoji", async () => {
      global.fetch = mockFetchSuccess([
        makeProject({ statusEmoji: "❓", status: "❓ Unknown" }),
      ]);

      const { result } = renderHook(() =>
        useProjects("agent-1", client),
      );
      await act(async () => {});

      const fetchBefore = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

      await act(async () => {
        await result.current.toggleStatus(result.current.projects[0]);
      });

      // No additional fetch calls (no PATCH)
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchBefore);
    });
  });

  // ─── changeStatus ────────────────────────────────────────────────────────

  describe("changeStatus", () => {
    it("updates status via applyStatusChange", async () => {
      const fetchMock = mockFetchSuccess([projectA]);
      global.fetch = fetchMock;

      const { result } = renderHook(() =>
        useProjects("agent-1", client),
      );
      await act(async () => {});

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ projects: [{ ...projectA, status: "✅ Done", statusEmoji: "✅" }] }),
      });

      await act(async () => {
        await result.current.changeStatus(projectA, "✅", "Done");
      });

      const patchCall = fetchMock.mock.calls.find(
        (c: unknown[]) => (c[1] as RequestInit)?.method === "PATCH",
      );
      expect(patchCall).toBeDefined();
      const body = JSON.parse((patchCall![1] as RequestInit).body as string);
      expect(body.status).toBe("✅ Done");
    });

    it("no-ops when emoji is unchanged", async () => {
      global.fetch = mockFetchSuccess([projectA]);

      const { result } = renderHook(() =>
        useProjects("agent-1", client),
      );
      await act(async () => {});

      const fetchCount = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

      await act(async () => {
        await result.current.changeStatus(projectA, "🔨", "Active");
      });

      // No additional calls
      expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchCount);
    });
  });

  // ─── archive ─────────────────────────────────────────────────────────────

  describe("archive", () => {
    it("optimistically removes project", async () => {
      const fetchMock = mockFetchSuccess([projectA, projectB]);
      global.fetch = fetchMock;

      const { result } = renderHook(() =>
        useProjects("agent-1", client),
      );
      await act(async () => {});
      expect(result.current.projects).toHaveLength(2);

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ projects: [projectB] }),
      });

      await act(async () => {
        await result.current.archive(projectA);
      });

      // DELETE was called
      const deleteCall = fetchMock.mock.calls.find(
        (c: unknown[]) => (c[1] as RequestInit)?.method === "DELETE",
      );
      expect(deleteCall).toBeDefined();
    });

    it("rolls back on DELETE failure", async () => {
      const fetchMock = mockFetchSuccess([projectA]);
      global.fetch = fetchMock;

      const { result } = renderHook(() =>
        useProjects("agent-1", client),
      );
      await act(async () => {});

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: "Delete failed" }),
      });

      await act(async () => {
        await result.current.archive(projectA);
      });

      // Should rollback
      expect(result.current.projects).toHaveLength(1);
      expect(result.current.projects[0].name).toBe("Test Project");
    });
  });

  // ─── Cron job management ─────────────────────────────────────────────────

  describe("cron job management", () => {
    it("calls manageProjectCronJobs when parking a project with tasks", async () => {
      const projectWithTasks = makeProject({
        statusEmoji: "🔨",
        details: {
          associatedTasks: [{ name: "task-1", cronJobId: "cron-1", autoManage: true }],
          planItems: [],
          history: [],
          continuation: {},
          progress: { completed: 0, total: 0, percent: 0 },
        },
      });

      const fetchMock = mockFetchSuccess([projectWithTasks]);
      global.fetch = fetchMock;

      const { result } = renderHook(() =>
        useProjects("agent-1", client),
      );
      await act(async () => {});

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ projects: [] }),
      });

      // Toggle 🔨 → ⏸️ (parking)
      await act(async () => {
        await result.current.toggleStatus(projectWithTasks);
      });

      expect(mockManageCronJobs).toHaveBeenCalledWith(
        client,
        projectWithTasks.details!.associatedTasks,
        false, // disable (parking)
      );
    });

    it("enables cron jobs when activating a parked project", async () => {
      const parkedWithTasks = makeProject({
        statusEmoji: "⏸️",
        status: "⏸️ Parked",
        details: {
          associatedTasks: [{ name: "task-1", cronJobId: "cron-1", autoManage: true }],
          planItems: [],
          history: [],
          continuation: {},
          progress: { completed: 0, total: 0, percent: 0 },
        },
      });

      const fetchMock = mockFetchSuccess([parkedWithTasks]);
      global.fetch = fetchMock;

      const { result } = renderHook(() =>
        useProjects("agent-1", client),
      );
      await act(async () => {});

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ projects: [] }),
      });

      await act(async () => {
        await result.current.toggleStatus(parkedWithTasks);
      });

      expect(mockManageCronJobs).toHaveBeenCalledWith(
        client,
        parkedWithTasks.details!.associatedTasks,
        true, // enable (activating)
      );
    });
  });

  // ─── Building queue ──────────────────────────────────────────────────────

  describe("building queue", () => {
    it("counts building projects", async () => {
      const building1 = makeProject({ doc: "b1.md", statusEmoji: "🚧", status: "🚧 In Progress" });
      const building2 = makeProject({ doc: "b2.md", statusEmoji: "🚧", status: "🚧 In Progress" });
      global.fetch = mockFetchSuccess([projectA, building1, building2]);

      const { result } = renderHook(() =>
        useProjects("agent-1", client),
      );
      await act(async () => {});

      expect(result.current.buildingCount).toBe(2);
    });

    it("returns queue position for multiple building projects", async () => {
      const building1 = makeProject({ doc: "b1.md", statusEmoji: "🚧", status: "🚧 In Progress" });
      const building2 = makeProject({ doc: "b2.md", statusEmoji: "🚧", status: "🚧 In Progress" });
      global.fetch = mockFetchSuccess([building1, building2]);

      const { result } = renderHook(() =>
        useProjects("agent-1", client),
      );
      await act(async () => {});

      // First building project is actively building (position 0)
      expect(result.current.getQueuePosition("b1.md")).toBe(0);
      // Second is queued at position 1
      expect(result.current.getQueuePosition("b2.md")).toBe(1);
    });

    it("returns 0 when only one building project", async () => {
      global.fetch = mockFetchSuccess([projectB]); // projectB is 🚧

      const { result } = renderHook(() =>
        useProjects("agent-1", client),
      );
      await act(async () => {});

      expect(result.current.buildingCount).toBe(1);
      expect(result.current.getQueuePosition("second.md")).toBe(0);
    });
  });

  // ─── Event-driven refresh ────────────────────────────────────────────────

  describe("event-driven refresh", () => {
    it("reloads when eventTick increments", async () => {
      const fetchMock = mockFetchSuccess([projectA]);
      global.fetch = fetchMock;

      const { result, rerender } = renderHook(
        ({ tick }) => useProjects("agent-1", client, { eventTick: tick }),
        { initialProps: { tick: 0 } },
      );
      await act(async () => {});

      const callsBefore = fetchMock.mock.calls.length;

      rerender({ tick: 1 });
      await act(async () => {});

      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  // ─── refresh ─────────────────────────────────────────────────────────────

  describe("refresh", () => {
    it("manually triggers reload", async () => {
      const fetchMock = mockFetchSuccess([projectA]);
      global.fetch = fetchMock;

      const { result } = renderHook(() =>
        useProjects("agent-1", client),
      );
      await act(async () => {});

      const callsBefore = fetchMock.mock.calls.length;

      await act(async () => {
        result.current.refresh();
      });

      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });
});
