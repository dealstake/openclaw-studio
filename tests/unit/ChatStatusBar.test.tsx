import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ChatStatusBar } from "@/components/chat/ChatStatusBar";

let rafId = 0;
beforeEach(() => {
  rafId = 0;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => {
    // Don't execute callback — just return an id. The initial tick() call
    // in useEffect runs synchronously; subsequent rAF calls are no-ops.
    return ++rafId;
  });
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ChatStatusBar", () => {
  it("renders idle state with correct label", () => {
    render(<ChatStatusBar state="idle" />);
    expect(screen.getByText("Idle")).toBeInTheDocument();
  });

  it("renders thinking state", () => {
    render(<ChatStatusBar state="thinking" runStartedAt={Date.now() - 5000} />);
    expect(screen.getByText("Thinking…")).toBeInTheDocument();
  });

  it("renders tool state", () => {
    render(<ChatStatusBar state="tool" runStartedAt={Date.now()} />);
    expect(screen.getByText("Using tool…")).toBeInTheDocument();
  });

  it("renders streaming state", () => {
    render(<ChatStatusBar state="streaming" runStartedAt={Date.now()} />);
    expect(screen.getByText("Streaming…")).toBeInTheDocument();
  });

  it("renders custom state string as fallback", () => {
    render(<ChatStatusBar state="compacting" />);
    expect(screen.getByText("compacting")).toBeInTheDocument();
  });

  it("shows model name when provided", () => {
    render(<ChatStatusBar state="idle" model="claude-opus-4-6" />);
    expect(screen.getByText("claude-opus-4-6")).toBeInTheDocument();
  });

  it("does not show timer when idle", () => {
    render(<ChatStatusBar state="idle" runStartedAt={Date.now() - 10000} />);
    expect(screen.queryByTitle(/Started at/)).not.toBeInTheDocument();
  });

  it("shows timer when active with runStartedAt", () => {
    const startTime = Date.now() - 65000;
    render(<ChatStatusBar state="thinking" runStartedAt={startTime} />);
    const timer = screen.getByTitle(/Started at/);
    expect(timer).toBeInTheDocument();
  });

  it("does not show timer when active without runStartedAt", () => {
    render(<ChatStatusBar state="thinking" />);
    expect(screen.queryByTitle(/Started at/)).not.toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <ChatStatusBar state="idle" className="my-custom-class" />
    );
    expect(container.firstChild).toHaveClass("my-custom-class");
  });

  it("renders with all props combined", () => {
    render(
      <ChatStatusBar
        state="thinking"
        model="claude-opus-4-6"
        runStartedAt={Date.now() - 3000}
        className="test-class"
      />
    );
    expect(screen.getByText("Thinking…")).toBeInTheDocument();
    expect(screen.getByText("claude-opus-4-6")).toBeInTheDocument();
    expect(screen.getByTitle(/Started at/)).toBeInTheDocument();
  });
});
