import { createElement } from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ManagementPanelContent } from "@/components/ManagementPanelContent";
import { ManagementPanelProvider } from "@/components/management/ManagementPanelContext";
import type { ManagementPanelContextValue, ManagementPanelProviderProps } from "@/components/management/ManagementPanelContext";
import type { ManagementPanelContentProps } from "@/components/ManagementPanelContent";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";

// Mock lazy-loaded panels
vi.mock("@/features/cron/components/CronPanel", () => ({
  CronPanel: () => createElement("div", { "data-testid": "cron-panel" }, "Cron"),
}));

vi.mock("@/features/usage/components/UsagePanel", () => ({
  UsagePanel: () => createElement("div", { "data-testid": "usage-panel" }, "Usage"),
}));

vi.mock("@/features/channels/components/ChannelsPanel", () => ({
  ChannelsPanel: () => createElement("div", { "data-testid": "channels-panel" }, "Channels"),
}));

vi.mock("@/features/agents/components/AgentInspectPanels", () => ({
  AgentSettingsPanel: () => createElement("div", { "data-testid": "settings-panel" }, "Settings"),
}));

afterEach(cleanup);

function makeClient(): GatewayClient {
  return { call: vi.fn() } as unknown as GatewayClient;
}

function defaultContext(overrides: Partial<ManagementPanelContextValue> = {}): ManagementPanelContextValue {
  return {
    client: makeClient(),
    status: "connected" as GatewayStatus,
    focusedAgentId: "agent-1",
    activeSessionKey: null,
    onViewTrace: vi.fn(),
    onTranscriptClick: vi.fn(),
    channelsSnapshot: null,
    channelsLoading: false,
    channelsError: null,
    onRefreshChannels: vi.fn(),
    settingsAgent: null,
    onCloseSettings: vi.fn(),
    onRenameAgent: vi.fn().mockResolvedValue(true),
    onNewSession: vi.fn(),
    onDeleteAgent: vi.fn(),
    onToolCallingToggle: vi.fn(),
    onThinkingTracesToggle: vi.fn(),
    onNavigateToTasks: vi.fn(),
    onStartCredentialWizard: null,
    ...overrides,
  };
}

function renderWithProvider(
  props: ManagementPanelContentProps,
  ctxOverrides: Partial<ManagementPanelContextValue> = {},
) {
  const ctx = defaultContext(ctxOverrides);
  return render(
    createElement(ManagementPanelProvider, { ...ctx, children: createElement(ManagementPanelContent, props) } as ManagementPanelProviderProps),
  );
}

describe("ManagementPanelContent", () => {
  it("renders nothing when tab is null", () => {
    const { container } = renderWithProvider({ tab: null });
    expect(container.innerHTML).toBe("");
  });

  it("renders UsagePanel when tab is usage", async () => {
    renderWithProvider({ tab: "usage" });
    expect(await screen.findByTestId("usage-panel")).toBeInTheDocument();
  });

  it("renders ChannelsPanel when tab is channels", async () => {
    renderWithProvider({ tab: "channels" });
    expect(await screen.findByTestId("channels-panel")).toBeInTheDocument();
  });

  it("renders AgentSettingsPanel when tab is settings and agent provided", async () => {
    const settingsAgent = {
      agentId: "agent-1",
      name: "Agent One",
      sessionKey: "key",
      status: "idle",
    } as ManagementPanelContextValue["settingsAgent"];
    renderWithProvider({ tab: "settings" }, { settingsAgent });
    expect(await screen.findByTestId("settings-panel")).toBeInTheDocument();
  });

  it("does not render settings panel when settingsAgent is null", () => {
    renderWithProvider({ tab: "settings" }, { settingsAgent: null });
    expect(screen.queryByTestId("settings-panel")).not.toBeInTheDocument();
  });
});
