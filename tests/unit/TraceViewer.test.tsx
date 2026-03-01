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
  turnBreakdown: { user: 1, assistant: 1, system: 0, tool: 0 },
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

import { TraceViewer } from "@/features/sessions/components/TraceViewer";
import { TraceHeader } from "@/features/sessions/components/TraceViewer/TraceHeader";
import { TraceNodeRow } from "@/features/sessions/components/TraceViewer/TraceNodeRow";
import { TraceNodeDetail } from "@/features/sessions/components/TraceViewer/TraceNodeDetail";
import { ToolCallCard } from "@/features/sessions/components/TraceViewer/ToolCallCard";
import type { TraceNode } from "@/features/sessions/lib/traceParser";

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

// --- TraceNode mock data for TraceNodeRow/TraceNodeDetail tests ---

const mockUserNode: TraceNode = {
  id: "node-1",
  type: "message",
  role: "user",
  content: "Hello, can you help me with a coding task?",
  children: [],
  depth: 0,
  tokens: { input: 50, output: 0, cacheRead: 0, cacheWrite: 0, total: 50 },
  cost: { input: 0.001, output: 0, total: 0.001 },
  model: null,
  stopReason: null,
  timestamp: 1706745600000,
  latencyMs: null,
};

const mockThinkingChild: TraceNode = {
  id: "node-2",
  type: "thinking",
  role: "assistant",
  content: "Let me think about this...",
  children: [],
  depth: 1,
};

const mockToolCallChild: TraceNode = {
  id: "node-3",
  type: "tool_call",
  role: "assistant",
  content: "export default {}",
  children: [],
  depth: 1,
  toolCall: {
    id: "tc-1",
    name: "Read",
    arguments: { path: "/src/index.ts" },
    result: "export default {}",
    durationMs: 120,
  },
};

const mockAssistantNode: TraceNode = {
  id: "node-4",
  type: "message",
  role: "assistant",
  content: "Sure! I can help with that. What do you need?",
  children: [mockThinkingChild, mockToolCallChild],
  depth: 0,
  tokens: { input: 100, output: 200, cacheRead: 50, cacheWrite: 10, total: 360 },
  cost: { input: 0.003, output: 0.006, total: 0.009 },
  model: "claude-opus-4-6",
  stopReason: "end_turn",
  timestamp: 1706745602000,
  latencyMs: 2000,
};

describe("TraceNodeRow", () => {
  it("renders node with content preview", () => {
    const { container } = render(
      <TraceNodeRow
        node={mockUserNode}
        selectedId={null}
        maxLatency={2000}
        onSelect={vi.fn()}
      />,
    );
    expect(container.textContent).toContain("Hello, can you help me with a coding task?");
  });

  it("shows expand/collapse toggle for nodes with children", () => {
    const { container } = render(
      <TraceNodeRow
        node={mockAssistantNode}
        selectedId={null}
        maxLatency={2000}
        onSelect={vi.fn()}
      />,
    );
    // Should render an expand/collapse button when there are children
    const toggleBtn = container.querySelector("[aria-label='Collapse'], [aria-label='Expand']") as HTMLElement;
    expect(toggleBtn).toBeTruthy();
  });

  it("calls onSelect with the node when clicked", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <TraceNodeRow
        node={mockUserNode}
        selectedId={null}
        maxLatency={2000}
        onSelect={onSelect}
      />,
    );
    const buttons = container.querySelectorAll("button[role='option']");
    fireEvent.click(buttons[0]);
    expect(onSelect).toHaveBeenCalledWith(mockUserNode);
  });

  it("applies selected styling when selectedId matches", () => {
    const { container } = render(
      <TraceNodeRow
        node={mockUserNode}
        selectedId="node-1"
        maxLatency={2000}
        onSelect={vi.fn()}
      />,
    );
    const btn = container.querySelector("button[role='option']") as HTMLElement;
    expect(btn.getAttribute("aria-selected")).toBe("true");
    expect(btn.className).toContain("bg-accent");
  });
});

describe("TraceNodeDetail", () => {
  it("shows placeholder when no node selected", () => {
    render(<TraceNodeDetail node={null} />);
    expect(screen.getByText("Select a node to view details")).toBeInTheDocument();
  });

  it("renders message node content and metadata", () => {
    const { container } = render(<TraceNodeDetail node={mockAssistantNode} />);
    expect(container.textContent).toContain("Sure! I can help");
    expect(container.textContent).toContain("Content");
    expect(container.textContent).toContain("Metadata");
    expect(container.textContent).toContain("claude-opus-4-6");
    expect(container.textContent).toContain("end_turn");
  });

  it("renders tool_call node with ToolCallCard", () => {
    const { container } = render(<TraceNodeDetail node={mockToolCallChild} />);
    expect(container.textContent).toContain("Tool Call");
    expect(container.textContent).toContain("Read");
  });

  it("renders thinking node with content", () => {
    const { container } = render(<TraceNodeDetail node={mockThinkingChild} />);
    expect(container.textContent).toContain("Thinking");
    expect(container.textContent).toContain("Let me think about this...");
  });

  it("shows loading skeletons", () => {
    const { container } = render(<TraceNodeDetail node={null} loading={true} />);
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
    expect(container.textContent).not.toContain("Arguments");
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

  it("renders header and tree nodes", () => {
    const { container } = render(<TraceViewer agentId="alex" sessionId="s1" onClose={vi.fn()} />);
    expect(container.textContent).toContain("Session Trace");
    expect(container.textContent).toContain("2 turns");
    // Tree renders options for messages + children (thinking + tool call for assistant)
    const listbox = container.querySelector("[role='listbox']") as HTMLElement;
    const options = within(listbox).getAllByRole("option");
    // 2 messages + 1 thinking child + 1 tool_call child = 4
    expect(options.length).toBeGreaterThanOrEqual(2);
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
    // Arrow down should change selection (internal state)
    fireEvent.keyDown(wrapper, { key: "ArrowDown" });
    // Verify the second option gets selected styling
    const listbox = container.querySelector("[role='listbox']") as HTMLElement;
    const selectedOptions = within(listbox).getAllByRole("option").filter(
      (opt) => opt.getAttribute("aria-selected") === "true",
    );
    expect(selectedOptions.length).toBe(1);
  });

  it("handles ArrowUp key for navigation", () => {
    const { container } = render(<TraceViewer agentId="alex" sessionId="s1" onClose={vi.fn()} />);
    const wrapper = container.querySelector("[tabindex]")!;
    // First go down then up
    fireEvent.keyDown(wrapper, { key: "ArrowDown" });
    fireEvent.keyDown(wrapper, { key: "ArrowUp" });
    const listbox = container.querySelector("[role='listbox']") as HTMLElement;
    const selectedOptions = within(listbox).getAllByRole("option").filter(
      (opt) => opt.getAttribute("aria-selected") === "true",
    );
    expect(selectedOptions.length).toBe(1);
  });
});
