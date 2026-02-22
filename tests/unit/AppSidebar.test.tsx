import { createElement } from "react";
import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { AppSidebar } from "@/layout/AppSidebar";
import type { GatewayClient, GatewayStatus } from "@/lib/gateway/GatewayClient";

// Mock useSessionHistory
vi.mock("@/features/sessions/hooks/useSessionHistory", () => ({
  useSessionHistory: () => ({
    groups: [
      {
        label: "Today",
        sessions: [
          { key: "session-1", displayName: "First Session", updatedAt: Date.now(), messageCount: 5 },
          { key: "session-2", displayName: "Second Session", updatedAt: Date.now() - 3600000, messageCount: 0 },
        ],
      },
    ],
    loading: false,
    load: vi.fn(),
    search: "",
    setSearch: vi.fn(),
  }),
}));

// Mock formatRelativeTime
vi.mock("@/lib/text/time", () => ({
  formatRelativeTime: () => "just now",
}));

// Mock ThemeToggle
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => createElement("button", { "data-testid": "theme-toggle" }, "Toggle"),
}));

afterEach(cleanup);

function makeClient(): GatewayClient {
  return { call: vi.fn() } as unknown as GatewayClient;
}

function defaultProps(overrides: Record<string, unknown> = {}) {
  return {
    client: makeClient(),
    status: "connected" as GatewayStatus,
    agentId: "agent-1",
    activeSessionKey: "session-1",
    onSelectSession: vi.fn(),
    onNewSession: vi.fn(),
    collapsed: false,
    onToggleCollapse: vi.fn(),
    onManagementNav: vi.fn(),
    activeManagementTab: null,
    ...overrides,
  };
}

describe("AppSidebar", () => {
  describe("expanded state", () => {
    it("renders session list with group labels", () => {
      render(createElement(AppSidebar, defaultProps()));
      expect(screen.getByText("Today")).toBeInTheDocument();
      expect(screen.getByText("First Session")).toBeInTheDocument();
      expect(screen.getByText("Second Session")).toBeInTheDocument();
    });

    it("renders Sessions header", () => {
      render(createElement(AppSidebar, defaultProps()));
      expect(screen.getByText("Sessions")).toBeInTheDocument();
    });

    it("renders new session button", () => {
      render(createElement(AppSidebar, defaultProps()));
      expect(screen.getByLabelText("New session")).toBeInTheDocument();
    });

    it("calls onNewSession when new session button clicked", () => {
      const onNewSession = vi.fn();
      render(createElement(AppSidebar, defaultProps({ onNewSession })));
      fireEvent.click(screen.getByLabelText("New session"));
      expect(onNewSession).toHaveBeenCalledOnce();
    });

    it("renders management nav items", () => {
      render(createElement(AppSidebar, defaultProps()));
      // Expanded mode has nav items with aria-labels
      expect(screen.getAllByLabelText("Sessions").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText("Usage")).toBeInTheDocument();
      expect(screen.getByLabelText("Channels")).toBeInTheDocument();
      expect(screen.getByLabelText("Cron")).toBeInTheDocument();
    });

    it("calls onManagementNav when nav item clicked", () => {
      const onManagementNav = vi.fn();
      render(createElement(AppSidebar, defaultProps({ onManagementNav })));
      fireEvent.click(screen.getByLabelText("Usage"));
      expect(onManagementNav).toHaveBeenCalledWith("usage");
    });

    it("renders collapse button", () => {
      render(createElement(AppSidebar, defaultProps()));
      expect(screen.getByLabelText("Collapse sidebar")).toBeInTheDocument();
    });

    it("calls onToggleCollapse", () => {
      const onToggleCollapse = vi.fn();
      render(createElement(AppSidebar, defaultProps({ onToggleCollapse })));
      fireEvent.click(screen.getByLabelText("Collapse sidebar"));
      expect(onToggleCollapse).toHaveBeenCalledOnce();
    });

    it("renders settings button", () => {
      render(createElement(AppSidebar, defaultProps()));
      expect(screen.getByLabelText("Settings")).toBeInTheDocument();
    });

    it("calls onSelectSession when session clicked", () => {
      const onSelectSession = vi.fn();
      render(createElement(AppSidebar, defaultProps({ onSelectSession })));
      fireEvent.click(screen.getByText("Second Session"));
      expect(onSelectSession).toHaveBeenCalledWith("session-2");
    });

    it("renders search input", () => {
      render(createElement(AppSidebar, defaultProps()));
      expect(screen.getByPlaceholderText("Search sessions…")).toBeInTheDocument();
    });
  });

  describe("collapsed state", () => {
    it("renders expand button", () => {
      render(createElement(AppSidebar, defaultProps({ collapsed: true })));
      expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
    });

    it("does not render session list", () => {
      render(createElement(AppSidebar, defaultProps({ collapsed: true })));
      expect(screen.queryByText("First Session")).not.toBeInTheDocument();
    });

    it("renders nav icon buttons with labels", () => {
      render(createElement(AppSidebar, defaultProps({ collapsed: true })));
      expect(screen.getAllByLabelText("Sessions").length).toBeGreaterThanOrEqual(1);
      expect(screen.getByLabelText("Usage")).toBeInTheDocument();
      expect(screen.getByLabelText("Channels")).toBeInTheDocument();
      expect(screen.getByLabelText("Cron")).toBeInTheDocument();
    });

    it("highlights active management tab", () => {
      render(createElement(AppSidebar, defaultProps({ collapsed: true, activeManagementTab: "usage" })));
      const usageBtn = screen.getByLabelText("Usage");
      expect(usageBtn.getAttribute("aria-current")).toBe("page");
    });
  });
});
