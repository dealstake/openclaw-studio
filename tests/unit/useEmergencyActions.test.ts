import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEmergencyActions } from "@/features/emergency/hooks/useEmergencyActions";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";

// Mock cron helpers
vi.mock("@/lib/cron/types", () => ({
  listCronJobs: vi.fn(),
  updateCronJob: vi.fn(),
}));

import { listCronJobs, updateCronJob } from "@/lib/cron/types";
const mockListCronJobs = vi.mocked(listCronJobs);
const mockUpdateCronJob = vi.mocked(updateCronJob);

function makeMockClient(): GatewayClient {
  return {
    call: vi.fn(),
  } as unknown as GatewayClient;
}

describe("useEmergencyActions", () => {
  let client: GatewayClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = makeMockClient();
  });

  describe("initial state", () => {
    it("starts with all statuses idle and no result", () => {
      const { result } = renderHook(() => useEmergencyActions(client, "connected"));
      expect(result.current.status).toEqual({
        "pause-all-cron": "idle",
        "stop-active-sessions": "idle",
        "cleanup-zombies": "idle",
      });
      expect(result.current.lastResult).toBeNull();
      expect(result.current.pausedJobIds).toEqual([]);
    });
  });

  describe("pauseAllCron", () => {
    it("pauses all enabled cron jobs", async () => {
      mockListCronJobs.mockResolvedValue({
        jobs: [
          { id: "job-1", enabled: true },
          { id: "job-2", enabled: true },
          { id: "job-3", enabled: false },
        ],
      } as never);
      mockUpdateCronJob.mockResolvedValue(undefined as never);

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      let actionResult: unknown;
      await act(async () => {
        actionResult = await result.current.executeAction("pause-all-cron");
      });

      expect(actionResult).toMatchObject({
        kind: "pause-all-cron",
        status: "success",
        affected: 2,
      });
      expect(mockUpdateCronJob).toHaveBeenCalledTimes(2);
      expect(result.current.pausedJobIds).toEqual(["job-1", "job-2"]);
      expect(result.current.status["pause-all-cron"]).toBe("success");
    });

    it("returns error when gateway disconnected", async () => {
      const { result } = renderHook(() => useEmergencyActions(client, "disconnected" as GatewayStatus));

      let actionResult: unknown;
      await act(async () => {
        actionResult = await result.current.executeAction("pause-all-cron");
      });

      expect(actionResult).toMatchObject({
        kind: "pause-all-cron",
        status: "error",
        affected: 0,
      });
    });

    it("handles partial failures gracefully", async () => {
      mockListCronJobs.mockResolvedValue({
        jobs: [
          { id: "job-1", enabled: true },
          { id: "job-2", enabled: true },
        ],
      } as never);
      mockUpdateCronJob
        .mockResolvedValueOnce(undefined as never)
        .mockRejectedValueOnce(new Error("RPC error"));

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      let actionResult: unknown;
      await act(async () => {
        actionResult = await result.current.executeAction("pause-all-cron");
      });

      expect(actionResult).toMatchObject({
        kind: "pause-all-cron",
        status: "success",
        affected: 1,
      });
    });

    it("handles listCronJobs error", async () => {
      mockListCronJobs.mockRejectedValue(new Error("Network failure"));

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      let actionResult: unknown;
      await act(async () => {
        actionResult = await result.current.executeAction("pause-all-cron");
      });

      expect(actionResult).toMatchObject({
        kind: "pause-all-cron",
        status: "error",
        message: "Network failure",
      });
      expect(result.current.status["pause-all-cron"]).toBe("error");
    });
  });

  describe("stopActiveSessions", () => {
    it("stops all active sessions", async () => {
      const mockCall = vi.mocked(client.call);
      mockCall
        .mockResolvedValueOnce({
          sessions: [
            { sessionKey: "s1", kind: "main" },
            { sessionKey: "s2", kind: "cron" },
          ],
        })
        .mockResolvedValueOnce(undefined) // kill s1
        .mockResolvedValueOnce(undefined); // kill s2

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      let actionResult: unknown;
      await act(async () => {
        actionResult = await result.current.executeAction("stop-active-sessions");
      });

      expect(actionResult).toMatchObject({
        kind: "stop-active-sessions",
        status: "success",
        affected: 2,
      });
      expect(mockCall).toHaveBeenCalledWith("sessions.list", { activeMinutes: 30 });
      expect(mockCall).toHaveBeenCalledWith("sessions.kill", { sessionKey: "s1" });
      expect(mockCall).toHaveBeenCalledWith("sessions.kill", { sessionKey: "s2" });
    });

    it("returns error when gateway disconnected", async () => {
      const { result } = renderHook(() => useEmergencyActions(client, "disconnected" as GatewayStatus));

      let actionResult: unknown;
      await act(async () => {
        actionResult = await result.current.executeAction("stop-active-sessions");
      });

      expect(actionResult).toMatchObject({ status: "error", affected: 0 });
    });

    it("handles empty session list", async () => {
      vi.mocked(client.call).mockResolvedValueOnce({ sessions: [] });

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      let actionResult: unknown;
      await act(async () => {
        actionResult = await result.current.executeAction("stop-active-sessions");
      });

      expect(actionResult).toMatchObject({ status: "success", affected: 0 });
    });
  });

  describe("cleanupZombies", () => {
    it("cleans up stale sessions older than 30 minutes", async () => {
      const oldTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
      const recentTime = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago

      const mockCall = vi.mocked(client.call);
      mockCall.mockImplementation(async (method: string) => {
        if (method === "sessions.list") {
          return {
            sessions: [
              { sessionKey: "zombie-1", lastActiveAt: oldTime },
              { sessionKey: "active-1", lastActiveAt: recentTime },
              { sessionKey: "no-activity" },
            ],
          };
        }
        return undefined; // sessions.kill
      });

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      let actionResult: unknown;
      await act(async () => {
        actionResult = await result.current.executeAction("cleanup-zombies");
      });

      const killCalls = mockCall.mock.calls.filter(([method]) => method === "sessions.kill");
      // zombie-1 (1hr old) and no-activity (no timestamp → treated as zombie) should be killed
      // active-1 (5min old) should NOT be killed
      expect(killCalls).toHaveLength(2);
      const killedKeys = killCalls.map(([, args]) => (args as { sessionKey: string }).sessionKey);
      expect(killedKeys).toContain("zombie-1");
      expect(killedKeys).toContain("no-activity");
      expect(killedKeys).not.toContain("active-1");
      expect(actionResult).toMatchObject({
        kind: "cleanup-zombies",
        status: "success",
        affected: 2,
      });
    });

    it("returns error when gateway disconnected", async () => {
      const { result } = renderHook(() => useEmergencyActions(client, "disconnected" as GatewayStatus));

      let actionResult: unknown;
      await act(async () => {
        actionResult = await result.current.executeAction("cleanup-zombies");
      });

      expect(actionResult).toMatchObject({ status: "error", affected: 0 });
    });
  });
});
