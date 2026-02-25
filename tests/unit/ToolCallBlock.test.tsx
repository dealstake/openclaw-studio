import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ToolCallBlock } from "@/components/chat/ToolCallBlock";

// Mock MarkdownViewer
vi.mock("@/components/MarkdownViewer", () => ({
  MarkdownViewer: ({ content, className }: { content: string; className?: string }) => (
    <div data-testid="markdown-viewer" className={className}>
      {content}
    </div>
  ),
}));

describe("ToolCallBlock", () => {
  it("renders tool name", () => {
    render(<ToolCallBlock name="web_search" phase="pending" />);
    expect(screen.getByText("web_search")).toBeDefined();
  });

  it("shows Pending badge for pending phase", () => {
    render(<ToolCallBlock name="tool_pending" phase="pending" />);
    expect(screen.getAllByText("Pending").length).toBeGreaterThan(0);
  });

  it("shows Running… badge for running phase", () => {
    render(<ToolCallBlock name="tool_running" phase="running" />);
    expect(screen.getByText("Running…")).toBeDefined();
  });

  it("shows Complete badge for complete phase", () => {
    render(<ToolCallBlock name="tool_complete" phase="complete" />);
    expect(screen.getByText("Complete")).toBeDefined();
  });

  it("shows Error badge for error phase", () => {
    render(<ToolCallBlock name="tool_error" phase="error" />);
    expect(screen.getByText("Error")).toBeDefined();
  });

  it("shows duration when complete with timestamps", () => {
    render(
      <ToolCallBlock
        name="tool_dur"
        phase="complete"
        startedAt={1000}
        completedAt={6000}
      />,
    );
    expect(screen.getByText("5s")).toBeDefined();
  });

  it("shows duration in minutes format for long runs", () => {
    render(
      <ToolCallBlock
        name="tool_longdur"
        phase="complete"
        startedAt={0}
        completedAt={125000}
      />,
    );
    expect(screen.getByText("2m 05s")).toBeDefined();
  });

  it("does not show duration while running", () => {
    const { container } = render(
      <ToolCallBlock
        name="tool_nodur"
        phase="running"
        startedAt={1000}
      />,
    );
    // No font-mono duration span should exist
    const durationSpans = container.querySelectorAll(".font-mono");
    expect(durationSpans.length).toBe(0);
  });

  it("renders args in collapsed content when expanded", () => {
    render(
      <ToolCallBlock
        name="tool_args"
        phase="complete"
        args='{"query":"test"}'
      />,
    );
    fireEvent.click(screen.getByText("tool_args"));
    expect(screen.getByText("Args")).toBeDefined();
  });

  it("pretty-prints valid JSON args", () => {
    render(
      <ToolCallBlock
        name="tool_json"
        phase="complete"
        args='{"cmd":"ls"}'
      />,
    );
    fireEvent.click(screen.getByText("tool_json"));
    const pre = screen.getByText(/\"cmd\"/);
    expect(pre).toBeDefined();
  });

  it("renders result via MarkdownViewer for complete phase", () => {
    render(
      <ToolCallBlock
        name="tool_result"
        phase="complete"
        result="Hello world"
      />,
    );
    fireEvent.click(screen.getByText("tool_result"));
    expect(screen.getByTestId("markdown-viewer")).toBeDefined();
    expect(screen.getByText("Hello world")).toBeDefined();
  });

  it("renders result via ErrorBanner for error phase", () => {
    render(
      <ToolCallBlock
        name="tool_err_result"
        phase="error"
        result="Command failed"
      />,
    );
    fireEvent.click(screen.getByText("tool_err_result"));
    expect(screen.getByRole("alert")).toBeDefined();
    expect(screen.getByText("Command failed")).toBeDefined();
  });

  it("does not render chevron when no args or result", () => {
    const { container } = render(
      <ToolCallBlock name="tool_nochevron" phase="pending" />,
    );
    const svgs = container.querySelectorAll("svg");
    // Wrench + Clock (phase icon) = 2 svgs in trigger
    expect(svgs.length).toBe(2);
  });

  it("applies custom className", () => {
    const { container } = render(
      <ToolCallBlock name="tool_class" phase="pending" className="my-custom" />,
    );
    expect(container.firstElementChild?.classList.contains("my-custom")).toBe(true);
  });

  it("handles zero duration correctly", () => {
    render(
      <ToolCallBlock
        name="tool_zero"
        phase="complete"
        startedAt={5000}
        completedAt={5000}
      />,
    );
    expect(screen.getByText("0s")).toBeDefined();
  });
});
