import { describe, expect, it, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useEmergencyActions } from "@/features/emergency/hooks/useEmergencyActions";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

afterEach(cleanup);

// ─── Mock Gateway Client ─────────────────────────────────────────────────────

function mockClient(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    call: vi.fn(async (method: string) => {
      if (method === "cron.list") {
        return { jobs: [] };
      }
      if (method === "sessions.list") {
        return { sessions: [] };
      }
      if (method === "sessions.kill") {
        return { ok: true };
      }
      if (method === "cron.update") {
        return { ok: true };
      }
      return {};
    }),
    ...overrides,
  } as unknown as GatewayClient;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useEmergencyActions", () => {
  let client: GatewayClient;

  beforeEach(() => {
    client = mockClient();
  });

  it("initializes with idle status for all actions", () => {
    const { result } = renderHook(() => useEmergencyActions(client, "connected"));

    expect(result.current.status["pause-all-cron"]).toBe("idle");
    expect(result.current.status["stop-active-sessions"]).toBe("idle");
    expect(result.current.status["cleanup-zombies"]).toBe("idle");
    expect(result.current.lastResult).toBeNull();
    expect(result.current.pausedJobIds).toEqual([]);
  });

  it("returns error when gateway is disconnected", async () => {
    const { result } = renderHook(() => useEmergencyActions(client, "disconnected"));

    let res;
    await act(async () => {
      res = await result.current.executeAction("pause-all-cron");
    });

    expect(res).toEqual({
      kind: "pause-all-cron",
      status: "error",
      message: "Gateway not connected",
      affected: 0,
    });
  });

  // ─── Pause All Cron ─────────────────────────────────────────────────────

  describe("pauseAllCron", () => {
    it("pauses all enabled cron jobs", async () => {
      client = mockClient({
        call: vi.fn(async (method: string) => {
          if (method === "cron.list") {
            return {
              jobs: [
                { id: "job-1", enabled: true },
                { id: "job-2", enabled: true },
                { id: "job-3", enabled: false },
              ],
            };
          }
          if (method === "cron.update") return { ok: true };
          return {};
        }),
      });

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      let res;
      await act(async () => {
        res = await result.current.executeAction("pause-all-cron");
      });

      expect(res).toMatchObject({ status: "success", affected: 2 });
      expect(result.current.pausedJobIds).toEqual(["job-1", "job-2"]);
      expect(result.current.status["pause-all-cron"]).toBe("success");

      // Should have called cron.update for each enabled job
      const updateCalls = (client.call as ReturnType<typeof vi.fn>).mock.calls.filter(
        (args: unknown[]) => args[0] === "cron.update"
      );
      expect(updateCalls).toHaveLength(2);
    });

    it("returns success with 0 affected when no enabled jobs", async () => {
      client = mockClient({
        call: vi.fn(async (method: string) => {
          if (method === "cron.list") return { jobs: [{ id: "j1", enabled: false }] };
          return {};
        }),
      });

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      let res;
      await act(async () => {
        res = await result.current.executeAction("pause-all-cron");
      });

      expect(res).toMatchObject({ status: "success", affected: 0 });
    });

    it("handles partial failures gracefully", async () => {
      let callCount = 0;
      client = mockClient({
        call: vi.fn(async (method: string) => {
          if (method === "cron.list") {
            return { jobs: [{ id: "j1", enabled: true }, { id: "j2", enabled: true }] };
          }
          if (method === "cron.update") {
            callCount++;
            if (callCount === 1) throw new Error("RPC fail");
            return { ok: true };
          }
          return {};
        }),
      });

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      let res;
      await act(async () => {
        res = await result.current.executeAction("pause-all-cron");
      });

      // Should report partial — j2 was paused but j1 failed
      expect(res).toMatchObject({ status: "partial", affected: 1, failed: 1 });
      expect(result.current.pausedJobIds).toEqual(["j2"]);
    });
  });

  // ─── Stop Active Sessions ──────────────────────────────────────────────

  describe("stopActiveSessions", () => {
    it("stops all active sessions", async () => {
      client = mockClient({
        call: vi.fn(async (method: string) => {
          if (method === "sessions.list") {
            return {
              sessions: [
                { sessionKey: "s1", kind: "main" },
                { sessionKey: "s2", kind: "cron" },
              ],
            };
          }
          if (method === "sessions.kill") return { ok: true };
          return {};
        }),
      });

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      let res;
      await act(async () => {
        res = await result.current.executeAction("stop-active-sessions");
      });

      expect(res).toMatchObject({ status: "success", affected: 2 });
      expect(result.current.status["stop-active-sessions"]).toBe("success");
    });

    it("returns success with 0 when no active sessions", async () => {
      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      let res;
      await act(async () => {
        res = await result.current.executeAction("stop-active-sessions");
      });

      expect(res).toMatchObject({ status: "success", affected: 0 });
    });
  });

  // ─── Cleanup Zombies ───────────────────────────────────────────────────

  describe("cleanupZombies", () => {
    it("cleans up sessions older than 30 minutes", async () => {
      const oldTime = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago
      const recentTime = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago

      client = mockClient({
        call: vi.fn(async (method: string) => {
          if (method === "sessions.list") {
            return {
              sessions: [
                { sessionKey: "zombie-1", lastActiveAt: oldTime },
                { sessionKey: "active-1", lastActiveAt: recentTime },
                { sessionKey: "no-time" }, // no lastActiveAt — should be skipped
              ],
            };
          }
          if (method === "sessions.kill") return { ok: true };
          return {};
        }),
      });

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      let res;
      await act(async () => {
        res = await result.current.executeAction("cleanup-zombies");
      });

      expect(res).toMatchObject({ status: "success", affected: 1 });
      expect(result.current.status["cleanup-zombies"]).toBe("success");
    });
  });

  // ─── Error Handling ────────────────────────────────────────────────────

  describe("error handling", () => {
    it("sets error status on list failure", async () => {
      client = mockClient({
        call: vi.fn(async () => {
          throw new Error("Network error");
        }),
      });

      const { result } = renderHook(() => useEmergencyActions(client, "connected"));

      let res;
      await act(async () => {
        res = await result.current.executeAction("pause-all-cron");
      });

      expect(res).toMatchObject({ status: "error", message: "Network error", affected: 0 });
      expect(result.current.status["pause-all-cron"]).toBe("error");
    });

    it("returns error for all actions when disconnected", async () => {
      const { result } = renderHook(() => useEmergencyActions(client, "disconnected"));

      for (const kind of ["pause-all-cron", "stop-active-sessions", "cleanup-zombies"] as const) {
        let res;
        await act(async () => {
          res = await result.current.executeAction(kind);
        });
        expect(res).toMatchObject({ status: "error", message: "Gateway not connected" });
      }
    });
  });
});
