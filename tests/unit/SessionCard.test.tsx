import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SessionCard } from "@/features/sessions/components/SessionCard";
import { TooltipProvider } from "@/components/ui/tooltip";

const fullUsage = {
  inputTokens: 100, outputTokens: 50, totalCost: 0.01, currency: "USD",
  cacheReadTokens: 0, cacheCreationTokens: 0, reasoningTokens: 0, messageCount: 3,
};

const renderCard = (overrides: Record<string, unknown> = {}) => {
  const props = {
    session: {
      key: "agent:alex:main",
      displayName: "Main Session",
      updatedAt: Date.now() - 60_000,
      origin: { label: "webchat" },
    },
    isActive: false,
    isExpanded: false,
    onToggle: vi.fn(),
    onSessionClick: vi.fn(),
    usage: null as typeof fullUsage | null,
    usageLoading: false,
    onLoadUsage: vi.fn(),
    busyKey: null as string | null,
    confirmDeleteKey: null as string | null,
    onSetConfirmDelete: vi.fn(),
    onDelete: vi.fn(),
    onCompact: vi.fn(),
    onViewTrace: vi.fn(),
    ...overrides,
  };
  return { ...render(<TooltipProvider><SessionCard {...props} /></TooltipProvider>), props };
};

describe("SessionCard", () => {
  it("renders session name", () => {
    renderCard();
    expect(screen.getByText("Main Session")).toBeInTheDocument();
  });

  it("renders agent id", () => {
    renderCard();
    expect(screen.getAllByText("Agent: alex").length).toBeGreaterThan(0);
  });

  it("calls onToggle when card body clicked", () => {
    const { props, container } = renderCard();
    const expandBtn = container.querySelector("[aria-expanded]")!;
    fireEvent.click(expandBtn);
    expect(props.onToggle).toHaveBeenCalledOnce();
  });

  it("loads usage when expanded without existing usage", () => {
    const { props } = renderCard({ isExpanded: true });
    expect(props.onLoadUsage).toHaveBeenCalledWith("agent:alex:main");
  });

  it("does not load usage when already present", () => {
    const { props } = renderCard({ isExpanded: true, usage: fullUsage });
    expect(props.onLoadUsage).not.toHaveBeenCalled();
  });

  it("shows delete confirmation when confirmDeleteKey matches", () => {
    renderCard({ confirmDeleteKey: "agent:alex:main" });
    expect(screen.getByText("Are you sure?")).toBeInTheDocument();
  });

  it("shows active indicator when isActive", () => {
    const { container } = renderCard({ isActive: true });
    expect(container.querySelector(".bg-emerald-500")).toBeTruthy();
  });

  it("shows Deleting… when busy during confirmation", () => {
    renderCard({ confirmDeleteKey: "agent:alex:main", busyKey: "agent:alex:main" });
    expect(screen.getByText("Deleting…")).toBeInTheDocument();
  });

  it("renders View button in DOM when onSessionClick provided", () => {
    const { container } = renderCard();
    // View button exists in DOM but hidden (opacity-0) until hover
    expect(container.querySelector("button")?.closest("[data-action]")).toBeTruthy();
  });
});
