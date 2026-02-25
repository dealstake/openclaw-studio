import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { UsageData } from "@/features/usage/hooks/useUsageData";

// Mock the hook before importing the component
const mockUsageData: UsageData = {
  entries: [],
  totalCost: 12.5,
  costByModel: new Map([
    [
      "claude-opus-4",
      { requests: 5, inputTokens: 50000, outputTokens: 10000, cost: 10 },
    ],
    [
      "claude-sonnet-4",
      { requests: 3, inputTokens: 20000, outputTokens: 5000, cost: 2.5 },
    ],
  ]),
  dailyTrends: [],
  totalInputTokens: 70000,
  totalOutputTokens: 15000,
  totalSessions: 8,
  loading: false,
  error: null,
  timeRange: "7d",
  setTimeRange: vi.fn(),
  refresh: vi.fn().mockResolvedValue(undefined),
};

vi.mock("@/features/usage/hooks/useUsageData", () => ({
  useUsageData: () => mockUsageData,
}));

// Mock chart component to avoid canvas/SVG issues in jsdom
vi.mock("@/features/usage/components/DailyTrendChart", () => ({
  DailyTrendChart: () => <div data-testid="daily-trend-chart" />,
}));

vi.mock("@/features/usage/components/CronCostTable", () => ({
  CronCostTable: () => <div data-testid="cron-cost-table" />,
}));

import { UsagePanel } from "@/features/usage/components/UsagePanel";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockClient = { call: vi.fn() } as any;

describe("UsagePanel", () => {
  afterEach(cleanup);

  it("renders header", () => {
    render(<UsagePanel client={mockClient} status="connected" />);
    expect(screen.getByText("Usage & Cost")).toBeInTheDocument();
  });

  it("renders time range buttons", () => {
    render(<UsagePanel client={mockClient} status="connected" />);
    for (const label of ["Today", "7d", "30d", "All"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders summary cards with formatted values", () => {
    render(<UsagePanel client={mockClient} status="connected" />);
    expect(screen.getAllByText("Total Cost").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Tokens").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sessions").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Top Model")).toBeInTheDocument();
  });

  it("renders model breakdown table", () => {
    render(<UsagePanel client={mockClient} status="connected" />);
    expect(screen.getByText("By Model")).toBeInTheDocument();
    // claude-opus-4 appears in both summary and table; just check table exists
    expect(screen.getAllByText("claude-opus-4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("claude-sonnet-4")).toBeInTheDocument();
  });

  it("renders refresh button", () => {
    render(<UsagePanel client={mockClient} status="connected" />);
    expect(screen.getByLabelText("Refresh")).toBeInTheDocument();
  });

  it("shows loading skeletons when loading with no data", () => {
    mockUsageData.loading = true;
    mockUsageData.totalSessions = 0;
    render(<UsagePanel client={mockClient} status="connected" />);
    // Summary cards should not render (loading state shows skeletons)
    expect(screen.queryByText("Total Cost")).not.toBeInTheDocument();
    // Restore
    mockUsageData.loading = false;
    mockUsageData.totalSessions = 8;
  });

  it("shows error banner when error exists", () => {
    mockUsageData.error = "Something went wrong";
    render(<UsagePanel client={mockClient} status="connected" />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    mockUsageData.error = null;
  });
});
