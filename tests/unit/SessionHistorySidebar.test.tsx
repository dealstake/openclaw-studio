import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SessionHistorySidebar } from "@/features/sessions/components/SessionHistorySidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

// Mock useSessionHistory
const mockLoad = vi.fn();
const mockSetSearch = vi.fn();
const mockTogglePin = vi.fn();
const mockDeleteSession = vi.fn().mockResolvedValue(undefined);
const mockRenameSession = vi.fn().mockResolvedValue(undefined);

let mockGroups: Array<{
  label: string;
  sessions: Array<{ key: string; displayName: string; updatedAt: number; messageCount: number }>;
}> = [];
let mockError: string | null = null;

vi.mock("@/features/sessions/hooks/useSessionHistory", () => ({
  useSessionHistory: () => ({
    groups: mockGroups,
    loading: false,
    error: mockError,
    load: mockLoad,
    search: "",
    setSearch: mockSetSearch,
    pinnedKeys: new Set<string>(),
    togglePin: mockTogglePin,
    deleteSession: mockDeleteSession,
    renameSession: mockRenameSession,
    totalFiltered: mockGroups.reduce((n, g) => n + g.sessions.length, 0),
    totalCount: mockGroups.reduce((n, g) => n + g.sessions.length, 0),
  }),
}));

const makeSessions = () => {
  mockGroups = [
    {
      label: "Today",
      sessions: [
        { key: "agent:alex:main", displayName: "Main Session", updatedAt: Date.now(), messageCount: 5 },
        { key: "agent:alex:sess2", displayName: "Test Session", updatedAt: Date.now() - 3600_000, messageCount: 3 },
      ],
    },
    {
      label: "Yesterday",
      sessions: [
        { key: "agent:alex:sess3", displayName: "Old Session", updatedAt: Date.now() - 86400_000, messageCount: 1 },
      ],
    },
  ];
};

/* eslint-disable @typescript-eslint/no-explicit-any */
const baseProps = () => ({
  client: { call: vi.fn() } as any,
  status: "connected" as any,
  agentId: "alex",
  activeSessionKey: "agent:alex:main",
  onSelectSession: vi.fn(),
  onNewSession: vi.fn(),
  collapsed: false,
  onToggleCollapse: vi.fn(),
});
/* eslint-enable @typescript-eslint/no-explicit-any */

const renderSidebar = (overrides: Record<string, unknown> = {}) => {
  const props = { ...baseProps(), ...overrides };
  return { ...render(<TooltipProvider><SessionHistorySidebar {...props} /></TooltipProvider>), props };
};

beforeEach(() => {
  cleanup();
  mockGroups = [];
  mockError = null;
  vi.clearAllMocks();
});

describe("SessionHistorySidebar", () => {
  it("shows empty state when no sessions", () => {
    renderSidebar();
    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
  });

  it("renders date groups and session names", () => {
    makeSessions();
    renderSidebar();
    expect(screen.getByText("Today")).toBeInTheDocument();
    expect(screen.getByText("Yesterday")).toBeInTheDocument();
    expect(screen.getByText("Main Session")).toBeInTheDocument();
    expect(screen.getByText("Test Session")).toBeInTheDocument();
    expect(screen.getByText("Old Session")).toBeInTheDocument();
  });

  it("renders New session and Collapse buttons in expanded mode", () => {
    renderSidebar();
    const newBtns = screen.getAllByLabelText("New session");
    expect(newBtns.length).toBeGreaterThan(0);
    const collapseBtns = screen.getAllByLabelText("Collapse session history");
    expect(collapseBtns.length).toBeGreaterThan(0);
  });

  it("renders expand button in collapsed mode", () => {
    makeSessions();
    renderSidebar({ collapsed: true });
    const expandBtns = screen.getAllByLabelText("Expand session history");
    expect(expandBtns.length).toBeGreaterThan(0);
  });

  it("calls load on mount", () => {
    renderSidebar();
    expect(mockLoad).toHaveBeenCalled();
  });

  it("shows error banner when error is set", () => {
    mockError = "Failed to load sessions";
    renderSidebar();
    expect(screen.getByText("Failed to load sessions")).toBeInTheDocument();
  });

  it("renders search input in expanded mode", () => {
    renderSidebar();
    const inputs = screen.getAllByPlaceholderText("Search sessions…");
    expect(inputs.length).toBeGreaterThan(0);
  });

  it("renders session options with listbox role", () => {
    makeSessions();
    renderSidebar();
    const options = screen.getAllByRole("option");
    expect(options.length).toBe(3); // 3 sessions
  });

  it("marks active session as selected", () => {
    makeSessions();
    renderSidebar();
    const options = screen.getAllByRole("option");
    const activeOption = options.find(o => o.getAttribute("aria-selected") === "true");
    expect(activeOption).toBeTruthy();
    expect(activeOption!.textContent).toContain("Main Session");
  });

  it("renders message count for sessions", () => {
    makeSessions();
    renderSidebar();
    expect(screen.getByText(/5 msgs/)).toBeInTheDocument();
    expect(screen.getByText(/3 msgs/)).toBeInTheDocument();
  });
});
