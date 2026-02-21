import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import React from "react";

// Mock useSessionTrace before importing TraceViewer
const mockLoad = vi.fn();
const mockSetSelectedTurnIndex = vi.fn();

const mockTurns = [
  {
    index: 0,
    role: "user" as const,
    content: "Hello, can you help me with a coding task?",
    toolCalls: [],
    tokens: { input: 50, output: 0, cacheRead: 0, cacheWrite: 0, total: 50 },
    cost: { input: 0.001, output: 0, total: 0.001 },
    model: null,
    stopReason: null,
    timestamp: 1706745600000,
    latencyMs: null,
    thinkingContent: undefined,
  },
  {
    index: 1,
    role: "assistant" as const,
    content: "Sure! I can help with that. What do you need?",
    toolCalls: [
      {
        id: "tc-1",
        name: "Read",
        arguments: { path: "/src/index.ts" },
        result: "export default {}",
        durationMs: 120,
      },
    ],
    tokens: { input: 100, output: 200, cacheRead: 50, cacheWrite: 10, total: 360 },
    cost: { input: 0.003, output: 0.006, total: 0.009 },
    model: "claude-opus-4-6",
    stopReason: "end_turn",
    timestamp: 1706745602000,
    latencyMs: 2000,
    thinkingContent: "Let me think about this...",
  },
];

const mockSummary = {
  sessionId: "test-session-123",
  model: "claude-opus-4-6",
  totalTurns: 2,
  totalTokens: 410,
  totalCost: 0.01,
  totalDurationMs: 2000,
  turnBreakdown: { user: 1, assistant: 1, tool: 0 },
};

let hookReturnValue = {
  turns: mockTurns,
  summary: mockSummary as typeof mockSummary | null,
  loading: false,
  error: null as string | null,
  selectedTurnIndex: 0 as number | null,
  setSelectedTurnIndex: mockSetSelectedTurnIndex,
  load: mockLoad,
};

vi.mock("@/features/sessions/hooks/useSessionTrace", () => ({
  useSessionTrace: () => hookReturnValue,
}));

// Mock @tanstack/react-virtual to avoid DOM measurement issues
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 40,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        key: String(i),
        index: i,
        start: i * 40,
        size: 40,
      })),
    measureElement: () => {},
  }),
}));

import { TraceViewer } from "@/features/sessions/components/TraceViewer";
import { TraceHeader } from "@/features/sessions/components/TraceViewer/TraceHeader";
import { TraceTurnRow } from "@/features/sessions/components/TraceViewer/TraceTurnRow";
import { TraceTurnDetail } from "@/features/sessions/components/TraceViewer/TraceTurnDetail";
import { ToolCallCard } from "@/features/sessions/components/TraceViewer/ToolCallCard";

describe("TraceHeader", () => {
  it("renders summary info", () => {
    render(<TraceHeader summary={mockSummary} onClose={vi.fn()} />);
    expect(screen.getByText("Session Trace")).toBeInTheDocument();
    expect(screen.getByText("claude-opus-4-6")).toBeInTheDocument();
    expect(screen.getByText("2 turns")).toBeInTheDocument();
    expect(screen.getByText("$0.01")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<TraceHeader summary={mockSummary} onClose={onClose} />);
    const btn = container.querySelector("[aria-label='Close trace viewer']") as HTMLElement;
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("TraceTurnRow", () => {
  it("renders turn with content preview", () => {
    const { container } = render(
      <TraceTurnRow
        turn={mockTurns[0]}
        isSelected={false}
        maxLatency={2000}
        onSelect={vi.fn()}
      />,
    );
    expect(container.textContent).toContain("Hello, can you help me with a coding task?");
  });

  it("shows tool call badge when turn has tool calls", () => {
    const { container } = render(
      <TraceTurnRow
        turn={mockTurns[1]}
        isSelected={false}
        maxLatency={2000}
        onSelect={vi.fn()}
      />,
    );
    // Turn index "2" and tool count "1" should be present
    expect(container.textContent).toContain("2");
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <TraceTurnRow
        turn={mockTurns[0]}
        isSelected={false}
        maxLatency={2000}
        onSelect={onSelect}
      />,
    );
    const btn = container.querySelector("button") as HTMLElement;
    fireEvent.click(btn);
    expect(onSelect).toHaveBeenCalledWith(0);
  });

  it("applies selected styling", () => {
    const { container } = render(
      <TraceTurnRow
        turn={mockTurns[0]}
        isSelected={true}
        maxLatency={2000}
        onSelect={vi.fn()}
      />,
    );
    const btn = container.querySelector("button") as HTMLElement;
    expect(btn.getAttribute("aria-selected")).toBe("true");
    expect(btn.className).toContain("bg-accent");
  });
});

describe("TraceTurnDetail", () => {
  it("shows placeholder when no turn selected", () => {
    render(<TraceTurnDetail turn={null} />);
    expect(screen.getByText("Select a turn to view details")).toBeInTheDocument();
  });

  it("renders turn content", () => {
    const { container } = render(<TraceTurnDetail turn={mockTurns[1]} />);
    expect(container.textContent).toContain("Sure! I can help");
    expect(container.textContent).toContain("Content");
  });

  it("shows tool calls section with count", () => {
    const { container } = render(<TraceTurnDetail turn={mockTurns[1]} />);
    expect(container.textContent).toContain("Tool Calls (1)");
  });

  it("shows metadata section with model and stop reason", () => {
    const { container } = render(<TraceTurnDetail turn={mockTurns[1]} />);
    expect(container.textContent).toContain("Metadata");
    expect(container.textContent).toContain("claude-opus-4-6");
    expect(container.textContent).toContain("end_turn");
  });

  it("has collapsible thinking section", () => {
    const { container } = render(<TraceTurnDetail turn={mockTurns[1]} />);
    // Thinking header exists
    // Find the thinking toggle button by its text content
    const buttons = container.querySelectorAll("button");
    const thinkingBtn = Array.from(buttons).find(b => b.textContent?.includes("Thinking"));
    expect(thinkingBtn).toBeTruthy();
    // Initially collapsed — thinking text not visible
    expect(container.textContent).not.toContain("Let me think about this...");
    // Expand
    fireEvent.click(thinkingBtn!);
    expect(container.textContent).toContain("Let me think about this...");
  });

  it("shows loading skeletons", () => {
    const { container } = render(<TraceTurnDetail turn={null} loading={true} />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });
});

describe("ToolCallCard", () => {
  const toolCall = mockTurns[1].toolCalls[0];

  it("renders tool name and duration", () => {
    const { container } = render(<ToolCallCard toolCall={toolCall} />);
    expect(container.textContent).toContain("Read");
    expect(container.textContent).toContain("120ms");
  });

  it("expands on click to show arguments and result", () => {
    const { container } = render(<ToolCallCard toolCall={toolCall} />);
    // Initially collapsed
    expect(container.textContent).not.toContain("Arguments");
    // Expand
    const btn = container.querySelector("button") as HTMLElement;
    fireEvent.click(btn);
    expect(container.textContent).toContain("Arguments");
    expect(container.textContent).toContain("Result");
  });
});

describe("TraceViewer", () => {
  beforeEach(() => {
    hookReturnValue = {
      turns: mockTurns,
      summary: mockSummary,
      loading: false,
      error: null,
      selectedTurnIndex: 0,
      setSelectedTurnIndex: mockSetSelectedTurnIndex,
      load: mockLoad,
    };
    mockLoad.mockClear();
    mockSetSelectedTurnIndex.mockClear();
  });

  it("renders header and turn list", () => {
    const { container } = render(<TraceViewer agentId="alex" sessionId="s1" onClose={vi.fn()} />);
    // Header present
    expect(container.textContent).toContain("Session Trace");
    expect(container.textContent).toContain("2 turns");
    // Both turns rendered as options
    const listbox = container.querySelector("[role='listbox']") as HTMLElement;
    const options = within(listbox).getAllByRole("option");
    expect(options).toHaveLength(2);
  });

  it("calls load on mount", () => {
    render(<TraceViewer agentId="alex" sessionId="s1" onClose={vi.fn()} />);
    expect(mockLoad).toHaveBeenCalledOnce();
  });

  it("shows error banner when error exists", () => {
    hookReturnValue = { ...hookReturnValue, error: "Network error" };
    const { container } = render(<TraceViewer agentId="alex" sessionId="s1" onClose={vi.fn()} />);
    expect(container.textContent).toContain("Network error");
  });

  it("shows loading skeleton when loading with no turns", () => {
    hookReturnValue = { ...hookReturnValue, turns: [], summary: null, loading: true };
    const { container } = render(<TraceViewer agentId="alex" sessionId="s1" onClose={vi.fn()} />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThan(0);
  });

  it("handles Escape key to close", () => {
    const onClose = vi.fn();
    const { container } = render(<TraceViewer agentId="alex" sessionId="s1" onClose={onClose} />);
    const wrapper = container.querySelector("[tabindex]")!;
    fireEvent.keyDown(wrapper, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("handles ArrowDown key for navigation", () => {
    const { container } = render(<TraceViewer agentId="alex" sessionId="s1" onClose={vi.fn()} />);
    const wrapper = container.querySelector("[tabindex]")!;
    fireEvent.keyDown(wrapper, { key: "ArrowDown" });
    expect(mockSetSelectedTurnIndex).toHaveBeenCalled();
  });

  it("handles ArrowUp key for navigation", () => {
    const { container } = render(<TraceViewer agentId="alex" sessionId="s1" onClose={vi.fn()} />);
    const wrapper = container.querySelector("[tabindex]")!;
    fireEvent.keyDown(wrapper, { key: "ArrowUp" });
    expect(mockSetSelectedTurnIndex).toHaveBeenCalled();
  });
});
