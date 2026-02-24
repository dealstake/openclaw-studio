import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useEmergencyActions } from "@/features/emergency/hooks/useEmergencyActions";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

afterEach(cleanup);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mockClient(callFn?: (...args: any[]) => Promise<any>) {
  return {
    call: vi.fn(
      callFn ??
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (async (method: any) => {
          if (method === "cron.list") return { jobs: [] };
          if (method === "sessions.list") return { sessions: [] };
          return {};
        })
    ),
  } as unknown as GatewayClient;
}

describe("Emergency bulk operations", () => {
  describe("pauseAllCron → restoreCron round-trip", () => {
    it("restores all previously paused jobs", async () => {
      const client = mockClient(async (method: string) => {
        if (method === "cron.list") {
          return { jobs: [{ id: "a", enabled: true }, { id: "b", enabled: true }] };
        }
        if (method === "cron.update") return { ok: true };
        return {};
      });

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      await act(async () => {
        await result.current.executeAction("pause-all-cron");
      });
      expect(result.current.pausedJobIds).toEqual(["a", "b"]);

      await act(async () => {
        await result.current.restoreCron();
      });
      expect(result.current.pausedJobIds).toEqual([]);

      // Verify re-enable calls were made
      const enableCalls = (client.call as ReturnType<typeof vi.fn>).mock.calls.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (args: any[]) => args[0] === "cron.update" && args[1]?.patch?.enabled === true
      );
      expect(enableCalls).toHaveLength(2);
    });

    it("keeps failed restore IDs for retry", async () => {
      let restoreCallCount = 0;
      const client = mockClient(async (method: string, params?: Record<string, unknown>) => {
        if (method === "cron.list") {
          return { jobs: [{ id: "a", enabled: true }, { id: "b", enabled: true }] };
        }
        if (method === "cron.update") {
          const patch = (params as Record<string, unknown>)?.patch as Record<string, unknown> | undefined;
          if (patch?.enabled === true) {
            restoreCallCount++;
            if (restoreCallCount === 1) throw new Error("restore fail");
          }
          return { ok: true };
        }
        return {};
      });

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      await act(async () => {
        await result.current.executeAction("pause-all-cron");
      });
      expect(result.current.pausedJobIds).toEqual(["a", "b"]);

      await act(async () => {
        try {
          await result.current.restoreCron();
        } catch {
          // Expected — partial failure
        }
      });

      // "a" failed, "b" succeeded → "a" should remain
      expect(result.current.pausedJobIds).toEqual(["a"]);
    });

    it("restoreCron is no-op when gateway disconnected", async () => {
      const client = mockClient();
      const { result } = renderHook(() => useEmergencyActions(client, "disconnected"));

      await act(async () => {
        await result.current.restoreCron();
      });

      expect((client.call as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0);
    });
  });

  describe("stopActiveSessions bulk", () => {
    it("handles partial kill failures", async () => {
      let killCount = 0;
      const client = mockClient(async (method: string) => {
        if (method === "sessions.list") {
          return {
            sessions: [
              { sessionKey: "s1", kind: "main" },
              { sessionKey: "s2", kind: "cron" },
              { sessionKey: "s3", kind: "cron" },
            ],
          };
        }
        if (method === "sessions.kill") {
          killCount++;
          if (killCount === 2) throw new Error("kill fail");
          return { ok: true };
        }
        return {};
      });

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      let res;
      await act(async () => {
        res = await result.current.executeAction("stop-active-sessions");
      });

      // 2 out of 3 succeeded (s2 kill failed)
      expect(res).toMatchObject({ status: "success", affected: 2 });
    });

    it("handles empty sessions gracefully", async () => {
      const client = mockClient(async (method: string) => {
        if (method === "sessions.list") return { sessions: [] };
        return {};
      });

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      let res;
      await act(async () => {
        res = await result.current.executeAction("stop-active-sessions");
      });

      expect(res).toMatchObject({ status: "success", affected: 0, message: "Stopped 0 sessions" });
    });
  });

  describe("cleanupZombies bulk", () => {
    it("handles partial kill failures in zombie cleanup", async () => {
      const oldTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      let killCount = 0;
      const client = mockClient(async (method: string) => {
        if (method === "sessions.list") {
          return {
            sessions: [
              { sessionKey: "z1", lastActiveAt: oldTime },
              { sessionKey: "z2", lastActiveAt: oldTime },
            ],
          };
        }
        if (method === "sessions.kill") {
          killCount++;
          if (killCount === 1) throw new Error("kill fail");
          return { ok: true };
        }
        return {};
      });

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      let res;
      await act(async () => {
        res = await result.current.executeAction("cleanup-zombies");
      });

      expect(res).toMatchObject({ status: "success", affected: 1 });
    });

    it("skips sessions without lastActiveAt", async () => {
      const client = mockClient(async (method: string) => {
        if (method === "sessions.list") {
          return {
            sessions: [
              { sessionKey: "s1" },
              { sessionKey: "s2", lastActiveAt: undefined },
            ],
          };
        }
        return {};
      });

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      let res;
      await act(async () => {
        res = await result.current.executeAction("cleanup-zombies");
      });

      expect(res).toMatchObject({ status: "success", affected: 0 });
    });
  });

  describe("sequential action execution", () => {
    it("can execute multiple different actions in sequence", async () => {
      const client = mockClient(async (method: string) => {
        if (method === "cron.list") return { jobs: [{ id: "j1", enabled: true }] };
        if (method === "cron.update") return { ok: true };
        if (method === "sessions.list") return { sessions: [{ sessionKey: "s1", kind: "main" }] };
        if (method === "sessions.kill") return { ok: true };
        return {};
      });

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      await act(async () => {
        const r1 = await result.current.executeAction("pause-all-cron");
        expect(r1).toMatchObject({ status: "success", affected: 1 });
      });

      await act(async () => {
        const r2 = await result.current.executeAction("stop-active-sessions");
        expect(r2).toMatchObject({ status: "success", affected: 1 });
      });

      expect(result.current.status["pause-all-cron"]).toBe("success");
      expect(result.current.status["stop-active-sessions"]).toBe("success");
    });
  });
});
