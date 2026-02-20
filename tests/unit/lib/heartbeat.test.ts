import { describe, it, expect } from "vitest";
import { resolveHeartbeatSettings } from "@/lib/gateway/heartbeat";

describe("resolveHeartbeatSettings", () => {
  it("returns defaults when no agent config exists", () => {
    const result = resolveHeartbeatSettings({}, "alex");
    expect(result.heartbeat.every).toBe("30m");
    expect(result.heartbeat.target).toBe("last");
    expect(result.heartbeat.includeReasoning).toBe(false);
    expect(result.heartbeat.ackMaxChars).toBe(300);
    expect(result.heartbeat.activeHours).toBeNull();
    expect(result.hasOverride).toBe(false);
  });

  it("uses global defaults when set", () => {
    const config = {
      agents: {
        defaults: {
          heartbeat: {
            every: "15m",
            target: "new",
            includeReasoning: true,
            ackMaxChars: 500,
          },
        },
        list: [{ id: "alex" }],
      },
    };
    const result = resolveHeartbeatSettings(config, "alex");
    expect(result.heartbeat.every).toBe("15m");
    expect(result.heartbeat.target).toBe("new");
    expect(result.heartbeat.includeReasoning).toBe(true);
    expect(result.heartbeat.ackMaxChars).toBe(500);
    expect(result.hasOverride).toBe(false);
  });

  it("agent override takes precedence over defaults", () => {
    const config = {
      agents: {
        defaults: {
          heartbeat: { every: "15m", target: "new" },
        },
        list: [
          { id: "alex", heartbeat: { every: "5m" } },
        ],
      },
    };
    const result = resolveHeartbeatSettings(config, "alex");
    expect(result.heartbeat.every).toBe("5m");
    // target comes from override merge (override has no target, falls back to default)
    expect(result.heartbeat.target).toBe("new");
    expect(result.hasOverride).toBe(true);
  });

  it("resolves activeHours from defaults", () => {
    const config = {
      agents: {
        defaults: {
          heartbeat: {
            activeHours: { start: "09:00", end: "17:00" },
          },
        },
        list: [{ id: "alex" }],
      },
    };
    const result = resolveHeartbeatSettings(config, "alex");
    expect(result.heartbeat.activeHours).toEqual({ start: "09:00", end: "17:00" });
  });

  it("agent override activeHours replaces defaults", () => {
    const config = {
      agents: {
        defaults: {
          heartbeat: {
            activeHours: { start: "09:00", end: "17:00" },
          },
        },
        list: [
          { id: "alex", heartbeat: { activeHours: { start: "06:00", end: "22:00" } } },
        ],
      },
    };
    const result = resolveHeartbeatSettings(config, "alex");
    expect(result.heartbeat.activeHours).toEqual({ start: "06:00", end: "22:00" });
  });

  it("returns hasOverride false for non-matching agent", () => {
    const config = {
      agents: {
        list: [{ id: "other", heartbeat: { every: "5m" } }],
      },
    };
    const result = resolveHeartbeatSettings(config, "alex");
    expect(result.hasOverride).toBe(false);
  });

  it("handles malformed activeHours gracefully", () => {
    const config = {
      agents: {
        defaults: {
          heartbeat: { activeHours: { start: "09:00" } }, // missing end
        },
        list: [{ id: "alex" }],
      },
    };
    const result = resolveHeartbeatSettings(config, "alex");
    expect(result.heartbeat.activeHours).toBeNull();
  });
});
