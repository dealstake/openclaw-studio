import { describe, expect, it, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useSettingsPanel } from "@/features/agents/hooks/useSettingsPanel";
import type { GatewayStatus } from "@/lib/gateway/GatewayClient";
import type { AgentState } from "@/features/agents/state/store";

afterEach(cleanup);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeAgent(overrides: Partial<AgentState> = {}): AgentState {
  return {
    agentId: "agent-1",
    name: "Test Agent",
    ...overrides,
  } as AgentState;
}

function defaultParams(overrides: Partial<Parameters<typeof useSettingsPanel>[0]> = {}) {
  return {
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

  it("auto-clears settingsAgentId for unknown agentId", async () => {
    const { result } = renderHook(() => useSettingsPanel(defaultParams()));

    await act(async () => {
      result.current.setSettingsAgentId("nonexistent");
    });

    // Auto-cleared because agent doesn't exist in agents array
    expect(result.current.settingsAgentId).toBeNull();
    expect(result.current.settingsAgent).toBeNull();
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

  it("updates settingsAgent when agents array changes", async () => {
    const agent = makeAgent({ agentId: "agent-1", name: "Old Name" });
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useSettingsPanel>[0]) => useSettingsPanel(props),
      { initialProps: defaultParams({ agents: [agent] }) }
    );

    await act(async () => {
      result.current.setSettingsAgentId("agent-1");
    });
    expect(result.current.settingsAgent?.name).toBe("Old Name");

    const updated = makeAgent({ agentId: "agent-1", name: "New Name" });
    rerender(defaultParams({ agents: [updated] }));

    expect(result.current.settingsAgent?.name).toBe("New Name");
  });
});
