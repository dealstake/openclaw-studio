import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { UsageQueryData } from "@/features/usage/hooks/useUsageQuery";

// Mock the hook before importing the component
const mockUsageData: UsageQueryData = {
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
  agentBreakdown: [
    { agentId: "alex", sessions: 5, cost: 10, inputTokens: 50000, outputTokens: 10000 },
  ],
  cronBreakdown: [],
  projectedMonthlyCost: 45.0,
  loading: false,
  error: null,
  timeRange: "7d",
  setTimeRange: vi.fn(),
  agentIdFilter: null,
  setAgentIdFilter: vi.fn(),
  refresh: vi.fn().mockResolvedValue(undefined),
  cachedAt: null,
  savings: null,
};

vi.mock("@/features/usage/hooks/useUsageQuery", () => ({
  useUsageQuery: () => mockUsageData,
}));

// Mock chart component to avoid canvas/SVG issues in jsdom
vi.mock("@/features/usage/components/DailyTrendChart", () => ({
  DailyTrendChart: () => <div data-testid="daily-trend-chart" />,
}));

vi.mock("@/features/usage/components/CronCostTable", () => ({
  CronCostTable: () => <div data-testid="cron-cost-table" />,
}));

import { UsagePanel } from "@/features/usage/components/UsagePanel";

describe("UsagePanel", () => {
  afterEach(cleanup);

  it("renders header", () => {
    render(<UsagePanel />);
    expect(screen.getByText("Usage & Cost")).toBeInTheDocument();
  });

  it("renders time range buttons", () => {
    render(<UsagePanel />);
    for (const label of ["Today", "7d", "30d", "All"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("renders summary cards with formatted values", () => {
    render(<UsagePanel />);
    expect(screen.getAllByText("Total Cost").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Tokens").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Sessions").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("Top Model")).toBeInTheDocument();
  });

  it("renders model breakdown table", () => {
    render(<UsagePanel />);
    expect(screen.getByText("By Model")).toBeInTheDocument();
    // claude-opus-4 appears in both summary and table; just check table exists
    expect(screen.getAllByText("claude-opus-4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("claude-sonnet-4")).toBeInTheDocument();
  });

  it("renders refresh button", () => {
    render(<UsagePanel />);
    expect(screen.getByLabelText("Refresh")).toBeInTheDocument();
  });

  it("shows loading skeletons when loading with no data", () => {
    mockUsageData.loading = true;
    mockUsageData.totalSessions = 0;
    render(<UsagePanel />);
    // Summary cards should not render (loading state shows skeletons)
    expect(screen.queryByText("Total Cost")).not.toBeInTheDocument();
    // Restore
    mockUsageData.loading = false;
    mockUsageData.totalSessions = 8;
  });

  it("shows error banner when error exists", () => {
    mockUsageData.error = "Something went wrong";
    render(<UsagePanel />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    mockUsageData.error = null;
  });
});
