import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { AgentWizardModal } from "@/features/agents/components/AgentWizardModal";

// Mock WizardChat
vi.mock("@/components/chat/WizardChat", () => ({
  WizardChat: vi.fn(({ starters }: { starters?: Array<{ text: string }> }) => (
    <div data-testid="wizard-chat">
      {starters?.map((s) => (
        <button key={s.text} data-testid="starter">
          {s.text}
        </button>
      ))}
    </div>
  )),
}));

// Mock AgentPreviewCard
vi.mock("@/features/agents/components/AgentPreviewCard", () => ({
  AgentPreviewCard: vi.fn(
    ({
      onConfirm,
      onRevise,
    }: {
      onConfirm: () => void;
      onRevise: () => void;
    }) => (
      <div data-testid="agent-preview">
        <button onClick={onConfirm} data-testid="confirm-btn">
          Create Agent
        </button>
        <button onClick={onRevise} data-testid="revise-btn">
          Revise
        </button>
      </div>
    ),
  ),
}));

vi.mock("@/lib/gateway/agentConfig", () => ({
  createGatewayAgent: vi.fn().mockResolvedValue({ id: "test-agent", name: "Test Agent" }),
}));

vi.mock("@/components/chat/wizardConfigExtractor", () => ({
  createConfigExtractor: vi.fn(() => () => null),
}));

vi.mock("@/features/agents/lib/agentWizardPrompt", () => ({
  buildAgentWizardPrompt: vi.fn(() => "system prompt"),
  getAgentWizardStarters: vi.fn(() => [
    { prompt: "test", text: "Test starter" },
  ]),
}));

vi.mock("@/features/agents/lib/agentConfigUtils", () => ({
  extractBrainFiles: vi.fn(() => ({})),
  isAgentConfig: vi.fn(() => false),
}));

const mockClient = {
  call: vi.fn().mockResolvedValue({ agents: [{ id: "alex", name: "Alex" }] }),
} as unknown as Parameters<typeof AgentWizardModal>[0]["client"];

describe("AgentWizardModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <AgentWizardModal
        open={false}
        client={mockClient}
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders WizardChat when open", () => {
    render(
      <AgentWizardModal
        open={true}
        client={mockClient}
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByTestId("wizard-chat")).toBeInTheDocument();
  });

  it("shows Agent Wizard header", () => {
    render(
      <AgentWizardModal
        open={true}
        client={mockClient}
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const headers = screen.getAllByText("Agent Wizard");
    expect(headers.length).toBeGreaterThanOrEqual(1);
  });

  it("calls onClose on Escape key", () => {
    const onClose = vi.fn();
    render(
      <AgentWizardModal
        open={true}
        client={mockClient}
        onCreated={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("fetches existing agents on open", () => {
    render(
      <AgentWizardModal
        open={true}
        client={mockClient}
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(mockClient.call).toHaveBeenCalledWith("agents.list", {});
  });

  it("renders close button with aria-label", () => {
    render(
      <AgentWizardModal
        open={true}
        client={mockClient}
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const closeButtons = screen.getAllByLabelText("Close wizard");
    expect(closeButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders dialog with aria-modal", () => {
    render(
      <AgentWizardModal
        open={true}
        client={mockClient}
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    const dialogs = screen.getAllByRole("dialog");
    expect(dialogs[0]).toHaveAttribute("aria-modal", "true");
  });
});
