import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AgentPreviewCard } from "@/features/agents/components/AgentPreviewCard";
import type { AgentConfig } from "@/features/agents/lib/agentConfigUtils";

afterEach(cleanup);

const mockConfig: AgentConfig = {
  name: "Research Scout",
  agentId: "research-scout",
  purpose: "Searches the web and summarizes research findings",
  personality: ["Thorough", "Concise", "Proactive"],
  model: "anthropic/claude-sonnet-4-20250514",
  tools: ["web_search", "web_fetch", "browser"],
  channels: ["webchat"],
};

const mockBrainFiles: Record<string, string> = {
  soul: "# SOUL.md\n\nI am Research Scout.",
  agents: "# AGENTS.md\n\n## Every Session\n1. Check research queue",
  heartbeat: "# HEARTBEAT.md\n\nCheck feeds. HEARTBEAT_OK",
};

describe("AgentPreviewCard", () => {
  it("renders agent name and purpose", () => {
    const { container } = render(
      <AgentPreviewCard
        config={mockConfig}
        brainFiles={mockBrainFiles}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );
    expect(container.textContent).toContain("Research Scout");
    expect(container.textContent).toContain(
      "Searches the web and summarizes research findings",
    );
  });

  it("renders agent ID badge", () => {
    const { container } = render(
      <AgentPreviewCard
        config={mockConfig}
        brainFiles={mockBrainFiles}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );
    expect(container.textContent).toContain("research-scout");
  });

  it("renders model badge with friendly name", () => {
    const { container } = render(
      <AgentPreviewCard
        config={mockConfig}
        brainFiles={mockBrainFiles}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );
    expect(container.textContent).toContain("Sonnet");
  });

  it("renders Opus for opus model", () => {
    const { container } = render(
      <AgentPreviewCard
        config={{ ...mockConfig, model: "anthropic/claude-opus-4-6" }}
        brainFiles={mockBrainFiles}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );
    expect(container.textContent).toContain("Opus");
  });

  it("renders personality traits", () => {
    const { container } = render(
      <AgentPreviewCard
        config={mockConfig}
        brainFiles={mockBrainFiles}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );
    expect(container.textContent).toContain("Thorough");
    expect(container.textContent).toContain("Concise");
    expect(container.textContent).toContain("Proactive");
  });

  it("renders tool chips", () => {
    const { container } = render(
      <AgentPreviewCard
        config={mockConfig}
        brainFiles={mockBrainFiles}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );
    expect(container.textContent).toContain("web_search");
    expect(container.textContent).toContain("web_fetch");
    expect(container.textContent).toContain("browser");
  });

  it("calls onConfirm when Create Agent clicked", () => {
    const onConfirm = vi.fn();
    render(
      <AgentPreviewCard
        config={mockConfig}
        brainFiles={mockBrainFiles}
        onConfirm={onConfirm}
        onRevise={vi.fn()}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /create agent/i });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onRevise when Revise clicked", () => {
    const onRevise = vi.fn();
    render(
      <AgentPreviewCard
        config={mockConfig}
        brainFiles={mockBrainFiles}
        onConfirm={vi.fn()}
        onRevise={onRevise}
      />,
    );
    const buttons = screen.getAllByRole("button", { name: /revise/i });
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onRevise).toHaveBeenCalledOnce();
  });

  it("hides tools section when tools array is empty", () => {
    const { container } = render(
      <AgentPreviewCard
        config={{ ...mockConfig, tools: [] }}
        brainFiles={mockBrainFiles}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );
    // The Wrench icon + "Tools" section label should not appear
    const toolsSections = container.querySelectorAll(".lucide-wrench");
    expect(toolsSections).toHaveLength(0);
  });

  it("hides brain files section when no brain files", () => {
    const { container } = render(
      <AgentPreviewCard
        config={mockConfig}
        brainFiles={{}}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );
    expect(container.textContent).not.toContain("Brain Files");
  });

  it("renders brain files section with collapsible", () => {
    const { container } = render(
      <AgentPreviewCard
        config={mockConfig}
        brainFiles={mockBrainFiles}
        onConfirm={vi.fn()}
        onRevise={vi.fn()}
      />,
    );
    expect(container.textContent).toContain("Brain Files");
  });
});
