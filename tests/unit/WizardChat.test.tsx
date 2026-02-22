import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { WizardChat, type WizardStarter } from "@/components/chat/WizardChat";

// ── Polyfill scrollIntoView for jsdom ──────────────────────────────────
Element.prototype.scrollIntoView = vi.fn();

// ── Mock useWizardSession ──────────────────────────────────────────────

const mockSendMessage = vi.fn();
const mockAbort = vi.fn();
const mockCleanup = vi.fn();

let sessionOverrides: Record<string, unknown> = {};

vi.mock("@/components/chat/hooks/useWizardSession", () => ({
  useWizardSession: () => ({
    messages: [],
    streamText: null,
    thinkingTrace: null,
    isStreaming: false,
    error: null,
    sendMessage: mockSendMessage,
    abort: mockAbort,
    cleanup: mockCleanup,
    ...sessionOverrides,
  }),
}));

// ── Mock MarkdownViewer ────────────────────────────────────────────────

vi.mock("@/components/MarkdownViewer", () => ({
  MarkdownViewer: ({ content, className }: { content: string; className?: string }) => (
    <div data-testid="markdown-viewer" className={className}>
      {content}
    </div>
  ),
}));

// ── Mock ThinkingBlock ─────────────────────────────────────────────────

vi.mock("@/components/chat/ThinkingBlock", () => ({
  ThinkingBlock: ({ text, streaming }: { text: string; streaming?: boolean }) => (
    <div data-testid="thinking-block" data-streaming={streaming}>
      {text}
    </div>
  ),
}));

// ── Helpers ────────────────────────────────────────────────────────────

const mockClient = {
  call: vi.fn(),
  onEvent: vi.fn(() => vi.fn()),
} as unknown as import("@/lib/gateway/GatewayClient").GatewayClient;

const starters: WizardStarter[] = [
  { prompt: "Create a daily summary task", text: "Daily summary" },
  { prompt: "Monitor my inbox", text: "Monitor inbox" },
];

function renderChat(overrides?: Partial<React.ComponentProps<typeof WizardChat>>) {
  return render(
    <WizardChat
      client={mockClient}
      agentId="alex"
      wizardType="task"
      systemPrompt="You are a task wizard."
      starters={starters}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionOverrides = {};
});

afterEach(() => {
  cleanup();
});

// ── Tests ──────────────────────────────────────────────────────────────

describe("WizardChat", () => {
  it("renders conversation starters when no messages", () => {
    renderChat();
    expect(screen.getByText("Daily summary")).toBeInTheDocument();
    expect(screen.getByText("Monitor inbox")).toBeInTheDocument();
    expect(screen.getByText("What would you like to create?")).toBeInTheDocument();
  });

  it("hides starters after messages exist", () => {
    sessionOverrides = {
      messages: [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ],
    };
    renderChat();
    expect(screen.queryByText("Daily summary")).not.toBeInTheDocument();
  });

  it("sends message on starter click", () => {
    renderChat();
    fireEvent.click(screen.getByText("Daily summary"));
    expect(mockSendMessage).toHaveBeenCalledWith("Create a daily summary task");
  });

  it("renders user and assistant messages", () => {
    sessionOverrides = {
      messages: [
        { role: "user", content: "Build a task" },
        { role: "assistant", content: "Sure, I can help." },
      ],
    };
    renderChat();
    expect(screen.getByText("Build a task")).toBeInTheDocument();
    expect(screen.getByText("Sure, I can help.")).toBeInTheDocument();
  });

  it("renders streaming text", () => {
    sessionOverrides = { streamText: "Working on it...", isStreaming: true };
    renderChat();
    expect(screen.getByText("Working on it...")).toBeInTheDocument();
  });

  it("renders thinking trace", () => {
    sessionOverrides = { thinkingTrace: "Let me think about this...", isStreaming: true };
    renderChat();
    expect(screen.getByTestId("thinking-block")).toHaveTextContent("Let me think about this...");
  });

  it("renders error message", () => {
    sessionOverrides = { error: "Connection lost" };
    renderChat();
    expect(screen.getByText("Connection lost")).toBeInTheDocument();
  });

  it("sends message on Enter key", async () => {
    renderChat();
    const textarea = screen.getByPlaceholderText("Describe what you need...");
    fireEvent.change(textarea, { target: { value: "Test message" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith("Test message");
    });
  });

  it("does not send on Shift+Enter", () => {
    renderChat();
    const textarea = screen.getByPlaceholderText("Describe what you need...");
    fireEvent.change(textarea, { target: { value: "Test" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("shows abort button while streaming", () => {
    sessionOverrides = { isStreaming: true };
    renderChat();
    expect(screen.getByLabelText("Stop generating")).toBeInTheDocument();
  });

  it("calls abort when stop button clicked", () => {
    sessionOverrides = { isStreaming: true };
    renderChat();
    fireEvent.click(screen.getByLabelText("Stop generating"));
    expect(mockAbort).toHaveBeenCalled();
  });

  it("disables send button when input is empty", () => {
    renderChat();
    const sendBtn = screen.getByLabelText("Send message");
    expect(sendBtn).toBeDisabled();
  });

  it("disables textarea while streaming", () => {
    sessionOverrides = { isStreaming: true };
    renderChat();
    const textarea = screen.getByPlaceholderText("Describe what you need...");
    expect(textarea).toBeDisabled();
  });

  it("calls abort then cleanup on unmount", async () => {
    const { unmount } = renderChat();
    unmount();
    // abort().then(cleanup) is async — flush microtasks
    await new Promise((r) => setTimeout(r, 0));
    expect(mockAbort).toHaveBeenCalled();
    expect(mockCleanup).toHaveBeenCalled();
  });
});
