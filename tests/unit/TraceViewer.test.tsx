import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

// Mock the hooks and child components
vi.mock("../../src/features/sessions/hooks/useSessionTrace", () => ({
  useSessionTrace: vi.fn(),
}));

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: vi.fn(() => ({
    getTotalSize: () => 400,
    getVirtualItems: () => [
      { key: "0", index: 0, start: 0, size: 40, end: 40 },
      { key: "1", index: 1, start: 40, size: 40, end: 80 },
    ],
    measureElement: vi.fn(),
  })),
}));

import { TraceViewer } from "../../src/features/sessions/components/TraceViewer";
import { useSessionTrace } from "../../src/features/sessions/hooks/useSessionTrace";
import type { TraceTurn, TraceSummary } from "../../src/features/sessions/lib/traceParser";

const mockUseSessionTrace = useSessionTrace as ReturnType<typeof vi.fn>;

const baseSummary: TraceSummary = {
  sessionId: "test-session",
  model: "claude-3",
  totalTurns: 2,
  totalTokens: 500,
  totalCost: 0.01,
  totalDurationMs: 5000,
  turnBreakdown: { user: 1, assistant: 1, tool: 0 },
};

const baseTurns: TraceTurn[] = [
  {
    index: 0,
    role: "user",
    content: "Hello world",
    toolCalls: [],
    tokens: { input: 100, output: 0, cacheRead: 0, cacheWrite: 0, total: 100 },
    cost: { input: 0.001, output: 0, total: 0.001 },
    model: "claude-3",
    stopReason: null,
    timestamp: 1000,
    latencyMs: null,
  },
  {
    index: 1,
    role: "assistant",
    content: "Hi there! How can I help?",
    toolCalls: [],
    tokens: { input: 100, output: 400, cacheRead: 0, cacheWrite: 0, total: 400 },
    cost: { input: 0.001, output: 0.008, total: 0.009 },
    model: "claude-3",
    stopReason: "end_turn",
    timestamp: 2000,
    latencyMs: 1000,
  },
];

describe("TraceViewer", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading state when loading with no turns", () => {
    mockUseSessionTrace.mockReturnValue({
      turns: [],
      summary: null,
      loading: true,
      error: null,
      selectedTurnIndex: null,
      setSelectedTurnIndex: vi.fn(),
      load: vi.fn(),
    });

    render(<TraceViewer agentId="alex" sessionId="s1" onClose={onClose} />);
    // Should show skeleton loading
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("renders turns and summary when loaded", () => {
    mockUseSessionTrace.mockReturnValue({
      turns: baseTurns,
      summary: baseSummary,
      loading: false,
      error: null,
      selectedTurnIndex: null,
      setSelectedTurnIndex: vi.fn(),
      load: vi.fn(),
    });

    render(<TraceViewer agentId="alex" sessionId="s1" onClose={onClose} />);
    expect(screen.getByRole("listbox", { name: /trace turns/i })).toBeInTheDocument();
    // Summary header should show model
    expect(screen.getByText("claude-3")).toBeInTheDocument();
  });

  it("renders error banner with retry", () => {
    const mockLoad = vi.fn();
    mockUseSessionTrace.mockReturnValue({
      turns: baseTurns,
      summary: baseSummary,
      loading: false,
      error: "Failed to load",
      selectedTurnIndex: null,
      setSelectedTurnIndex: vi.fn(),
      load: mockLoad,
    });

    render(<TraceViewer agentId="alex" sessionId="s1" onClose={onClose} />);
    expect(screen.getByText("Failed to load")).toBeInTheDocument();
  });

  it("calls onClose when Escape is pressed", () => {
    mockUseSessionTrace.mockReturnValue({
      turns: baseTurns,
      summary: baseSummary,
      loading: false,
      error: null,
      selectedTurnIndex: null,
      setSelectedTurnIndex: vi.fn(),
      load: vi.fn(),
    });

    render(<TraceViewer agentId="alex" sessionId="s1" onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("navigates turns with arrow keys", () => {
    const setSelectedTurnIndex = vi.fn();
    mockUseSessionTrace.mockReturnValue({
      turns: baseTurns,
      summary: baseSummary,
      loading: false,
      error: null,
      selectedTurnIndex: null,
      setSelectedTurnIndex,
      load: vi.fn(),
    });

    render(<TraceViewer agentId="alex" sessionId="s1" onClose={onClose} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(setSelectedTurnIndex).toHaveBeenCalled();
  });

  it("calls load on mount", () => {
    const mockLoad = vi.fn();
    mockUseSessionTrace.mockReturnValue({
      turns: [],
      summary: null,
      loading: true,
      error: null,
      selectedTurnIndex: null,
      setSelectedTurnIndex: vi.fn(),
      load: mockLoad,
    });

    render(<TraceViewer agentId="alex" sessionId="s1" onClose={onClose} />);
    expect(mockLoad).toHaveBeenCalled();
  });
});
