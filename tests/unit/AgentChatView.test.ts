import { describe, it, expect } from "vitest";
import type { MessagePart } from "@/lib/chat/types";

// Test the grouping logic and component rendering contract
// We test the pure logic here; component rendering tested via snapshot/integration

describe("AgentChatView groupParts logic", () => {
  // Import the module to verify it compiles and exports correctly
  it("exports AgentChatView as a named export", async () => {
    const mod = await import(
      "@/features/agents/components/AgentChatView"
    );
    expect(mod.AgentChatView).toBeDefined();
    expect(typeof mod.AgentChatView).toBe("object"); // React.memo wraps as object
  });

  it("handles empty parts array", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { AgentChatView } = await import(
      "@/features/agents/components/AgentChatView"
    );
    const { createElement } = await import("react");

    const { container } = render(createElement(AgentChatView, { parts: [], streaming: false }));
    expect(container.innerHTML).toBe("");
  });

  it("renders user message with stripped > prefix", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { AgentChatView } = await import(
      "@/features/agents/components/AgentChatView"
    );
    const { createElement } = await import("react");

    const parts: MessagePart[] = [
      { type: "text", text: "> Hello there" },
    ];

    render(createElement(AgentChatView, { parts, streaming: false }));
    expect(screen.getByText("Hello there")).toBeTruthy();
  });

  it("renders assistant text part", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { AgentChatView } = await import(
      "@/features/agents/components/AgentChatView"
    );
    const { createElement } = await import("react");

    const parts: MessagePart[] = [
      { type: "text", text: "Here is my response" },
    ];

    render(createElement(AgentChatView, { parts, streaming: false }));
    expect(screen.getByText("Here is my response")).toBeTruthy();
  });

  it("renders reasoning part as ThinkingBlock", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { AgentChatView } = await import(
      "@/features/agents/components/AgentChatView"
    );
    const { createElement } = await import("react");

    const parts: MessagePart[] = [
      {
        type: "reasoning",
        text: "Let me think about this",
        streaming: false,
        startedAt: 1000,
        completedAt: 5000,
      },
    ];

    render(createElement(AgentChatView, { parts, streaming: false }));
    // ThinkingBlock renders "Thought" when not streaming
    expect(screen.getByText("Thought")).toBeTruthy();
  });

  it("renders tool-invocation part as ToolCallBlock", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { AgentChatView } = await import(
      "@/features/agents/components/AgentChatView"
    );
    const { createElement } = await import("react");

    const parts: MessagePart[] = [
      {
        type: "tool-invocation",
        toolCallId: "tc-1",
        name: "web_search",
        phase: "complete",
        args: '{"query":"test"}',
        result: "Found results",
        startedAt: 1000,
        completedAt: 3000,
      },
    ];

    render(createElement(AgentChatView, { parts, streaming: false }));
    expect(screen.getByText("web_search")).toBeTruthy();
    expect(screen.getByText("Complete")).toBeTruthy();
  });

  it("does not render inline for non-error status parts (shown via composer ring)", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { AgentChatView } = await import(
      "@/features/agents/components/AgentChatView"
    );
    const { createElement } = await import("react");

    const parts: MessagePart[] = [
      {
        type: "status",
        state: "thinking",
        model: "claude-opus-4-6",
      },
    ];

    render(createElement(AgentChatView, { parts, streaming: false }));
    // Non-error status parts are now shown via the composer button progress ring,
    // not rendered inline in the chat transcript.
    expect(screen.queryByText("Thinking…")).toBeNull();
  });

  it("renders error status parts inline via ChatStatusBar", async () => {
    const { render, screen } = await import("@testing-library/react");
    const { AgentChatView } = await import(
      "@/features/agents/components/AgentChatView"
    );
    const { createElement } = await import("react");

    const parts: MessagePart[] = [
      {
        type: "status",
        state: "error",
        model: "claude-opus-4-6",
        errorMessage: "Connection lost",
      },
    ];

    render(createElement(AgentChatView, { parts, streaming: false }));
    expect(screen.getByText("Connection lost")).toBeTruthy();
  });

  it("renders mixed user + assistant groups with separators", async () => {
    const { render } = await import("@testing-library/react");
    const { AgentChatView } = await import(
      "@/features/agents/components/AgentChatView"
    );
    const { createElement } = await import("react");

    const parts: MessagePart[] = [
      { type: "text", text: "> User message" },
      { type: "reasoning", text: "thinking...", streaming: false },
      { type: "text", text: "Assistant reply" },
    ];

    const { container } = render(
      createElement(AgentChatView, { parts, streaming: false })
    );

    // Should have a turn separator between user and assistant groups
    const separators = container.querySelectorAll('[role="separator"]');
    expect(separators.length).toBeGreaterThanOrEqual(1);
  });
});
