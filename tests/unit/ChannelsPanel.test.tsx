import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ChannelsPanel } from "@/features/channels/components/ChannelsPanel";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

// Mock useChannels hook to control panel state
const mockUseChannels = vi.fn();
vi.mock("@/features/channels/hooks/useChannels", () => ({
  useChannels: (...args: unknown[]) => mockUseChannels(...args),
}));

function makeClient(): GatewayClient {
  return { call: vi.fn() } as unknown as GatewayClient;
}

function defaultHookReturn(overrides: Record<string, unknown> = {}) {
  return {
    channels: [],
    loading: false,
    error: null,
    refresh: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    disconnect: vi.fn(),
    reconnect: vi.fn(),
    readConfig: vi.fn(),
    ...overrides,
  };
}

describe("ChannelsPanel", () => {
  beforeEach(() => {
    mockUseChannels.mockReturnValue(defaultHookReturn());
  });
  afterEach(cleanup);

  it("renders loading skeletons when loading with no data", () => {
    mockUseChannels.mockReturnValue(defaultHookReturn({ loading: true }));
    const { container } = render(
      <ChannelsPanel client={makeClient()} status="connected" />,
    );
    expect(container.querySelector("[class*=animate-pulse]")).toBeTruthy();
  });

  it("renders empty state when no channels", () => {
    render(<ChannelsPanel client={makeClient()} status="connected" />);
    expect(screen.getByText("No channels configured")).toBeInTheDocument();
  });

  it("renders channel list", () => {
    mockUseChannels.mockReturnValue(
      defaultHookReturn({
        channels: [
          {
            channelId: "whatsapp",
            config: {},
            connectionStatus: "connected",
            template: { id: "whatsapp", label: "WhatsApp", description: "WhatsApp Web", icon: "💬" },
          },
          {
            channelId: "telegram",
            config: {},
            connectionStatus: "connecting",
            template: { id: "telegram", label: "Telegram", description: "Telegram bot", icon: "✈️" },
          },
        ],
      }),
    );
    render(<ChannelsPanel client={makeClient()} status="connected" />);
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Telegram")).toBeInTheDocument();
  });

  it("renders ErrorBanner when error is present", () => {
    mockUseChannels.mockReturnValue(
      defaultHookReturn({ error: "Something broke" }),
    );
    render(<ChannelsPanel client={makeClient()} status="connected" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something broke")).toBeInTheDocument();
  });

  it("shows stats bar when channels exist", () => {
    mockUseChannels.mockReturnValue(
      defaultHookReturn({
        channels: [
          { channelId: "telegram", config: {}, connectionStatus: "connected", template: { label: "Telegram", icon: "✈️", description: "" } },
        ],
      }),
    );
    render(<ChannelsPanel client={makeClient()} status="connected" />);
    expect(screen.getByText("1 connected")).toBeInTheDocument();
    expect(screen.getByText("· 1 total")).toBeInTheDocument();
  });
});
