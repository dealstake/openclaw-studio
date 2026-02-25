import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCommandPalette } from "@/features/command-palette/hooks/useCommandPalette";
import type { CommandPaletteProps } from "@/features/command-palette/lib/types";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

function makeProps(overrides: Partial<CommandPaletteProps> = {}): CommandPaletteProps {
  return {
    onNavigateTab: vi.fn(),
    onOpenContextPanel: vi.fn(),
    agentIds: ["alex", "bob"],
    currentAgentId: "alex",
    onSwitchAgent: vi.fn(),
    client: null,
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("useCommandPalette", () => {
  it("returns navigation commands for all tabs", () => {
    const { result } = renderHook(() => useCommandPalette(makeProps()));
    const navActions = result.current.actions.filter((a) => a.group === "navigation");
    expect(navActions.length).toBe(9);
    expect(navActions.map((a) => a.id)).toContain("nav-projects");
    expect(navActions.map((a) => a.id)).toContain("nav-sessions");
  });

  it("returns agent switch commands for non-current agents", () => {
    const { result } = renderHook(() =>
      useCommandPalette(makeProps({ agentIds: ["alex", "bob", "carol"], currentAgentId: "alex" })),
    );
    const agentActions = result.current.actions.filter((a) => a.group === "agents");
    expect(agentActions).toHaveLength(2);
    expect(agentActions.map((a) => a.id)).toContain("agent-bob");
    expect(agentActions.map((a) => a.id)).toContain("agent-carol");
  });

  it("excludes agent commands when no agentIds provided", () => {
    const { result } = renderHook(() =>
      useCommandPalette(makeProps({ agentIds: undefined, onSwitchAgent: undefined })),
    );
    const agentActions = result.current.actions.filter((a) => a.group === "agents");
    expect(agentActions).toHaveLength(0);
  });

  it("includes action commands when client is provided", () => {
    const client = { call: vi.fn().mockResolvedValue({}) } as unknown as GatewayClient;
    const { result } = renderHook(() => useCommandPalette(makeProps({ client })));
    const actionCmds = result.current.actions.filter((a) => a.group === "actions");
    expect(actionCmds.length).toBeGreaterThanOrEqual(2);
    expect(actionCmds.map((a) => a.id)).toContain("action-restart-gateway");
    expect(actionCmds.map((a) => a.id)).toContain("action-run-cron");
  });

  it("excludes action commands when client is null", () => {
    const { result } = renderHook(() => useCommandPalette(makeProps({ client: null })));
    const actionCmds = result.current.actions.filter((a) => a.group === "actions");
    expect(actionCmds).toHaveLength(0);
  });

  it("toggle opens and closes palette", () => {
    const { result } = renderHook(() => useCommandPalette(makeProps()));
    expect(result.current.open).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.open).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.open).toBe(false);
  });

  it("selecting a nav action calls onNavigateTab and onOpenContextPanel", () => {
    const props = makeProps();
    const { result } = renderHook(() => useCommandPalette(props));
    const projectsAction = result.current.actions.find((a) => a.id === "nav-projects");
    expect(projectsAction).toBeDefined();
    act(() => projectsAction!.onSelect());
    expect(props.onNavigateTab).toHaveBeenCalledWith("projects");
    expect(props.onOpenContextPanel).toHaveBeenCalled();
  });

  it("selecting restart gateway action calls client.call", () => {
    const client = { call: vi.fn().mockResolvedValue({}) } as unknown as GatewayClient;
    const { result } = renderHook(() => useCommandPalette(makeProps({ client })));
    const restartAction = result.current.actions.find((a) => a.id === "action-restart-gateway");
    act(() => restartAction!.onSelect());
    expect(client.call).toHaveBeenCalledWith("gateway.restart", {});
  });

  it("navigation actions have keyboard shortcuts where defined", () => {
    const { result } = renderHook(() => useCommandPalette(makeProps()));
    const projectsAction = result.current.actions.find((a) => a.id === "nav-projects");
    expect(projectsAction?.shortcut).toBe("⌘⇧P");
  });
});
