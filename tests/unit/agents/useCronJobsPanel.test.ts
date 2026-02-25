import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCronJobsPanel } from "@/features/agents/hooks/useCronJobsPanel";

// Mock the cron/types module
vi.mock("@/lib/cron/types", () => ({
  listCronJobs: vi.fn(),
  filterCronJobsForAgent: vi.fn(),
  removeCronJob: vi.fn(),
  runCronJobNow: vi.fn(),
  updateCronJob: vi.fn(),
}));

vi.mock("@/lib/gateway/GatewayClient", () => ({
  isGatewayDisconnectLikeError: vi.fn(() => false),
}));

import {
  listCronJobs,
  filterCronJobsForAgent,
  removeCronJob,
  runCronJobNow,
  updateCronJob,
} from "@/lib/cron/types";

const mockClient = {} as Parameters<typeof useCronJobsPanel>[0]["client"];

const makeCronJob = (id: string, updatedAtMs = Date.now()) => ({
  id,
  name: `Job ${id}`,
  updatedAtMs,
  enabled: true,
  schedule: { kind: "every" as const, everyMs: 60000 },
  payload: { kind: "systemEvent" as const, text: "test" },
  sessionTarget: "main" as const,
  wakeMode: "next-heartbeat" as const,
  state: {},
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useCronJobsPanel", () => {
  describe("loadCronJobs", () => {
    it("loads and sorts cron jobs for an agent", async () => {
      const jobs = [makeCronJob("a", 100), makeCronJob("b", 200)];
      vi.mocked(listCronJobs).mockResolvedValue({ jobs: [] });
      vi.mocked(filterCronJobsForAgent).mockReturnValue(jobs);

      const { result } = renderHook(() => useCronJobsPanel({ client: mockClient }));

      await act(async () => {
        await result.current.loadCronJobs("agent1");
      });

      expect(listCronJobs).toHaveBeenCalledWith(mockClient, { includeDisabled: true });
      expect(filterCronJobsForAgent).toHaveBeenCalled();
      // Sorted by updatedAtMs descending
      expect(result.current.cronJobs[0].id).toBe("b");
      expect(result.current.cronJobs[1].id).toBe("a");
      expect(result.current.cronLoading).toBe(false);
      expect(result.current.cronError).toBeNull();
    });

    it("sets error on empty agentId", async () => {
      const { result } = renderHook(() => useCronJobsPanel({ client: mockClient }));

      await act(async () => {
        await result.current.loadCronJobs("  ");
      });

      expect(result.current.cronJobs).toEqual([]);
      expect(result.current.cronError).toMatch(/missing agent id/);
    });

    it("handles load errors", async () => {
      vi.mocked(listCronJobs).mockRejectedValue(new Error("Network failure"));

      const { result } = renderHook(() => useCronJobsPanel({ client: mockClient }));

      await act(async () => {
        await result.current.loadCronJobs("agent1");
      });

      expect(result.current.cronJobs).toEqual([]);
      expect(result.current.cronError).toBe("Network failure");
      expect(result.current.cronLoading).toBe(false);
    });
  });

  describe("handleRunCronJob", () => {
    it("runs a cron job and reloads", async () => {
      vi.mocked(runCronJobNow).mockResolvedValue({ ok: true, ran: true });
      vi.mocked(listCronJobs).mockResolvedValue({ jobs: [] });
      vi.mocked(filterCronJobsForAgent).mockReturnValue([]);

      const { result } = renderHook(() => useCronJobsPanel({ client: mockClient }));

      await act(async () => {
        await result.current.handleRunCronJob("agent1", "job1");
      });

      expect(runCronJobNow).toHaveBeenCalledWith(mockClient, "job1");
      expect(result.current.cronRunBusyJobId).toBeNull();
    });

    it("skips when agentId or jobId is empty", async () => {
      const { result } = renderHook(() => useCronJobsPanel({ client: mockClient }));

      await act(async () => {
        await result.current.handleRunCronJob("", "job1");
      });

      expect(runCronJobNow).not.toHaveBeenCalled();
    });

    it("sets error on failure", async () => {
      vi.mocked(runCronJobNow).mockRejectedValue(new Error("Run failed"));

      const { result } = renderHook(() => useCronJobsPanel({ client: mockClient }));

      await act(async () => {
        await result.current.handleRunCronJob("agent1", "job1");
      });

      expect(result.current.cronError).toBe("Run failed");
    });
  });

  describe("handleDeleteCronJob", () => {
    it("deletes a cron job and reloads", async () => {
      vi.mocked(removeCronJob).mockResolvedValue({ ok: true, removed: true });
      vi.mocked(listCronJobs).mockResolvedValue({ jobs: [] });
      vi.mocked(filterCronJobsForAgent).mockReturnValue([]);

      const { result } = renderHook(() => useCronJobsPanel({ client: mockClient }));

      await act(async () => {
        await result.current.handleDeleteCronJob("agent1", "job1");
      });

      expect(removeCronJob).toHaveBeenCalledWith(mockClient, "job1");
    });

    it("sets error on failure", async () => {
      vi.mocked(removeCronJob).mockRejectedValue(new Error("Delete failed"));

      const { result } = renderHook(() => useCronJobsPanel({ client: mockClient }));

      await act(async () => {
        await result.current.handleDeleteCronJob("agent1", "job1");
      });

      expect(result.current.cronError).toBe("Delete failed");
    });

    it("skips when already busy", async () => {
      vi.mocked(runCronJobNow).mockImplementation(() => new Promise(() => {})); // never resolves
      const { result } = renderHook(() => useCronJobsPanel({ client: mockClient }));

      // Start a run (will hang)
      act(() => {
        void result.current.handleRunCronJob("agent1", "job1");
      });

      // Try to delete while run is busy — should skip
      await act(async () => {
        await result.current.handleDeleteCronJob("agent1", "job2");
      });

      expect(removeCronJob).not.toHaveBeenCalled();
    });
  });

  describe("handleToggleCronJob", () => {
    it("toggles a cron job enabled state", async () => {
      vi.mocked(updateCronJob).mockResolvedValue({ ok: true });
      vi.mocked(listCronJobs).mockResolvedValue({ jobs: [] });
      vi.mocked(filterCronJobsForAgent).mockReturnValue([]);

      const { result } = renderHook(() => useCronJobsPanel({ client: mockClient }));

      await act(async () => {
        await result.current.handleToggleCronJob("agent1", "job1", false);
      });

      expect(updateCronJob).toHaveBeenCalledWith(mockClient, "job1", { enabled: false });
    });

    it("sets error on toggle failure", async () => {
      vi.mocked(updateCronJob).mockRejectedValue(new Error("Toggle failed"));

      const { result } = renderHook(() => useCronJobsPanel({ client: mockClient }));

      await act(async () => {
        await result.current.handleToggleCronJob("agent1", "job1", true);
      });

      expect(result.current.cronError).toBe("Toggle failed");
    });
  });

  describe("resetCron", () => {
    it("clears all state", async () => {
      vi.mocked(listCronJobs).mockRejectedValue(new Error("fail"));

      const { result } = renderHook(() => useCronJobsPanel({ client: mockClient }));

      await act(async () => {
        await result.current.loadCronJobs("agent1");
      });

      expect(result.current.cronError).toBeTruthy();

      act(() => {
        result.current.resetCron();
      });

      expect(result.current.cronJobs).toEqual([]);
      expect(result.current.cronError).toBeNull();
      expect(result.current.cronLoading).toBe(false);
      expect(result.current.cronRunBusyJobId).toBeNull();
      expect(result.current.cronDeleteBusyJobId).toBeNull();
      expect(result.current.cronToggleBusyJobId).toBeNull();
    });
  });
});
