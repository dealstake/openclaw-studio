import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useSettingsPanel } from "@/features/agents/hooks/useSettingsPanel";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { AgentState } from "@/features/agents/state/store";

afterEach(cleanup);

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@/lib/cron/types", () => ({
  listCronJobs: vi.fn().mockResolvedValue({ jobs: [] }),
  filterCronJobsForAgent: vi.fn().mockReturnValue([]),
  removeCronJob: vi.fn().mockResolvedValue({ ok: true, removed: true }),
  runCronJobNow: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("@/lib/gateway/agentConfig", () => ({
  listHeartbeatsForAgent: vi.fn().mockResolvedValue({ heartbeats: [] }),
  removeGatewayHeartbeatOverride: vi.fn().mockResolvedValue({ ok: true }),
  triggerHeartbeatNow: vi.fn().mockResolvedValue({ ok: true }),
}));

// Import mocks after vi.mock
const cronMocks = await import("@/lib/cron/types");
const heartbeatMocks = await import("@/lib/gateway/agentConfig");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeClient(): GatewayClient {
  return {
    call: vi.fn().mockResolvedValue({ ok: true }),
    status: "connected" as GatewayStatus,
  } as unknown as GatewayClient;
}

function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    agentId: "agent-1",
    name: "Test Agent",
    ...overrides,
  } as AgentState;
}

function defaultParams(overrides: Partial<Parameters<typeof useSettingsPanel>[0]> = {}) {
  return {
    client: makeClient(),
    status: "connected" as GatewayStatus,
    agents: [makeAgent()],
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useSettingsPanel", () => {
  it("starts with no settings agent selected", () => {
    const { result } = renderHook(() => useSettingsPanel(defaultParams()));
    expect(result.current.settingsAgentId).toBeNull();
    expect(result.current.settingsAgent).toBeNull();
    expect(result.current.settingsCronJobs).toEqual([]);
    expect(result.current.settingsHeartbeats).toEqual([]);
  });

  it("loads cron jobs and heartbeats when agent is selected", async () => {
    const { result } = renderHook(() => useSettingsPanel(defaultParams()));

    await act(async () => {
      result.current.setSettingsAgentId("agent-1");
    });

    expect(cronMocks.listCronJobs).toHaveBeenCalled();
    expect(heartbeatMocks.listHeartbeatsForAgent).toHaveBeenCalled();
  });

  it("resolves settingsAgent from agents array", async () => {
    const agent = makeAgent({ agentId: "agent-1", name: "My Agent" });
    const { result } = renderHook(() => useSettingsPanel(defaultParams({ agents: [agent] })));

    await act(async () => {
      result.current.setSettingsAgentId("agent-1");
    });

    expect(result.current.settingsAgent).toBeTruthy();
    expect(result.current.settingsAgent?.name).toBe("My Agent");
  });

  it("clears state when agent is deselected", async () => {
    const { result } = renderHook(() => useSettingsPanel(defaultParams()));

    await act(async () => {
      result.current.setSettingsAgentId("agent-1");
    });
    await act(async () => {
      result.current.setSettingsAgentId(null);
    });

    expect(result.current.settingsCronJobs).toEqual([]);
    expect(result.current.settingsHeartbeats).toEqual([]);
    expect(result.current.settingsCronError).toBeNull();
    expect(result.current.settingsHeartbeatError).toBeNull();
  });

  it("clears state when status becomes disconnected", async () => {
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useSettingsPanel>[0]) => useSettingsPanel(props),
      { initialProps: defaultParams() }
    );

    await act(async () => {
      result.current.setSettingsAgentId("agent-1");
    });

    rerender(defaultParams({ status: "disconnected" }));

    expect(result.current.settingsCronJobs).toEqual([]);
    expect(result.current.settingsHeartbeats).toEqual([]);
  });

  it("auto-clears settingsAgentId when agent no longer exists", async () => {
    const agent = makeAgent({ agentId: "agent-1" });
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useSettingsPanel>[0]) => useSettingsPanel(props),
      { initialProps: defaultParams({ agents: [agent] }) }
    );

    await act(async () => {
      result.current.setSettingsAgentId("agent-1");
    });
    expect(result.current.settingsAgentId).toBe("agent-1");

    // Remove the agent from the list
    rerender(defaultParams({ agents: [] }));

    expect(result.current.settingsAgentId).toBeNull();
  });

  it("handles run cron job action", async () => {
    const { result } = renderHook(() => useSettingsPanel(defaultParams()));

    await act(async () => {
      result.current.setSettingsAgentId("agent-1");
    });

    await act(async () => {
      await result.current.handleRunCronJob("agent-1", "job-1");
    });

    expect(cronMocks.runCronJobNow).toHaveBeenCalledWith(expect.anything(), "job-1");
  });

  it("handles delete cron job action", async () => {
    const { result } = renderHook(() => useSettingsPanel(defaultParams()));

    await act(async () => {
      result.current.setSettingsAgentId("agent-1");
    });

    await act(async () => {
      await result.current.handleDeleteCronJob("agent-1", "job-1");
    });

    expect(cronMocks.removeCronJob).toHaveBeenCalledWith(expect.anything(), "job-1");
  });

  it("handles run heartbeat action", async () => {
    const { result } = renderHook(() => useSettingsPanel(defaultParams()));

    await act(async () => {
      result.current.setSettingsAgentId("agent-1");
    });

    await act(async () => {
      await result.current.handleRunHeartbeat("agent-1", "hb-1");
    });

    expect(heartbeatMocks.triggerHeartbeatNow).toHaveBeenCalledWith(expect.anything(), "agent-1");
  });

  it("handles delete heartbeat action", async () => {
    const { result } = renderHook(() => useSettingsPanel(defaultParams()));

    await act(async () => {
      result.current.setSettingsAgentId("agent-1");
    });

    await act(async () => {
      await result.current.handleDeleteHeartbeat("agent-1", "hb-1");
    });

    expect(heartbeatMocks.removeGatewayHeartbeatOverride).toHaveBeenCalledWith(
      expect.objectContaining({ agentId: "agent-1" })
    );
  });

  it("guards against concurrent cron operations", async () => {
    // Make runCronJobNow hang
    let resolveRun: () => void;
    vi.mocked(cronMocks.runCronJobNow).mockImplementation(
      () => new Promise((resolve) => { resolveRun = () => resolve({ ok: true, ran: true }); })
    );

    const { result } = renderHook(() => useSettingsPanel(defaultParams()));

    await act(async () => {
      result.current.setSettingsAgentId("agent-1");
    });

    // Clear any prior calls from setup
    vi.mocked(cronMocks.removeCronJob).mockClear();

    // Start a run
    let runPromise: Promise<void>;
    await act(async () => {
      runPromise = result.current.handleRunCronJob("agent-1", "job-1");
    });

    expect(result.current.cronRunBusyJobId).toBe("job-1");

    // Try to delete while run is busy — should be no-op
    await act(async () => {
      await result.current.handleDeleteCronJob("agent-1", "job-2");
    });

    expect(cronMocks.removeCronJob).not.toHaveBeenCalled();

    // Resolve the run
    await act(async () => {
      resolveRun!();
      await runPromise!;
    });
  });
});
