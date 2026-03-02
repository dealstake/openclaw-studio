import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ThinkingBlock } from "@/components/chat/ThinkingBlock";

// Mock MarkdownViewer to avoid pulling in react-markdown
vi.mock("@/components/MarkdownViewer", () => ({
  MarkdownViewer: ({ content, className }: { content: string; className?: string }) => (
    <div data-testid="markdown-viewer" className={className}>
      {content}
    </div>
  ),
}));

describe("ThinkingBlock", () => {
  afterEach(() => cleanup());

  it("renders with collapsed state by default when not streaming", () => {
    const { container } = render(
      <ThinkingBlock text="Some reasoning" startedAt={1000} completedAt={6000} />,
    );
    // Trigger button should be visible
    expect(screen.getByText("Thought")).toBeDefined();
    // Duration should show
    expect(screen.getByText("5s")).toBeDefined();
    // Content should not be visible (collapsed)
    expect(container.querySelector("[data-testid='markdown-viewer']")).toBeNull();
  });

  it("renders open when streaming", () => {
    render(<ThinkingBlock text="Partial thought" streaming />);
    expect(screen.getByText("Thinking…")).toBeDefined();
    // Should show the streaming content
    expect(screen.getByTestId("markdown-viewer")).toBeDefined();
    expect(screen.getByText("Partial thought")).toBeDefined();
  });

  it("shows shimmer placeholder when streaming with no text", () => {
    render(<ThinkingBlock text="" streaming />);
    expect(screen.getByText("Reasoning…")).toBeDefined();
  });

  it("toggles content on click", () => {
    const { getByText, queryByTestId } = render(
      <ThinkingBlock text="Hidden reasoning" startedAt={1000} completedAt={4000} />,
    );
    // Initially collapsed
    const content = document.querySelector("[data-slot='collapsible-content']");
    expect(content?.getAttribute("data-state")).toBe("closed");

    // Click to expand
    fireEvent.click(getByText("Thought"));
    expect(content?.getAttribute("data-state")).toBe("open");
    expect(queryByTestId("markdown-viewer")).not.toBeNull();

    // Click to collapse
    fireEvent.click(getByText("Thought"));
    expect(content?.getAttribute("data-state")).toBe("closed");
  });

  it("displays duration in seconds for short durations", () => {
    render(
      <ThinkingBlock text="thought" startedAt={1000} completedAt={13000} />,
    );
    expect(screen.getByText("12s")).toBeDefined();
  });

  it("displays duration in minutes and seconds for longer durations", () => {
    const { getByText } = render(
      <ThinkingBlock text="thought" startedAt={0} completedAt={125000} />,
    );
    expect(getByText("2m 05s")).toBeDefined();
  });

  it("does not show duration while streaming", () => {
    const { container } = render(
      <ThinkingBlock text="thinking" streaming startedAt={1000} />,
    );
    // No duration text should appear
    const monospanElements = container.querySelectorAll(".font-sans");
    expect(monospanElements.length).toBe(0);
  });

  it("does not show duration when no timestamps provided", () => {
    const { getByText } = render(<ThinkingBlock text="thought" />);
    expect(getByText("Thought")).toBeDefined();
  });

  it("applies custom className", () => {
    const { container } = render(
      <ThinkingBlock text="test" className="my-custom-class" />,
    );
    // The root collapsible element should have the custom class
    expect(container.firstElementChild?.classList.contains("my-custom-class")).toBe(true);
  });

  it("shows Brain icon with animate-pulse when streaming", () => {
    const { container } = render(
      <ThinkingBlock text="thinking" streaming />,
    );
    const icon = container.querySelector(".animate-pulse");
    expect(icon).not.toBeNull();
  });

  it("shows chevron rotated when open", () => {
    const { container } = render(
      <ThinkingBlock text="thought" streaming />,
    );
    const chevron = container.querySelector(".rotate-90");
    expect(chevron).not.toBeNull();
  });

  it("rounds duration to 0s for very short durations", () => {
    render(
      <ThinkingBlock text="fast" startedAt={1000} completedAt={1100} />,
    );
    expect(screen.getByText("0s")).toBeDefined();
  });
});
