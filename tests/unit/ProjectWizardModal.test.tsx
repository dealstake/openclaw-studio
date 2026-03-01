import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { ProjectWizardModal } from "@/features/projects/components/ProjectWizardModal";
import { slugify, generateMarkdown } from "@/features/projects/lib/projectMarkdown";
import type { ProjectConfig } from "@/features/projects/components/ProjectPreviewCard";

// ── Polyfill scrollIntoView for jsdom ──────────────────────────────────
Element.prototype.scrollIntoView = vi.fn();

// ── Mock Radix Dialog Portal ───────────────────────────────────────────

vi.mock("@radix-ui/react-dialog", async () => {
  const actual = await vi.importActual<typeof import("@radix-ui/react-dialog")>(
    "@radix-ui/react-dialog",
  );
  return {
    ...actual,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// ── Mock ModalOverlay ──────────────────────────────────────────────────

vi.mock("@/components/ModalOverlay", () => ({
  ModalOverlay: () => <div data-testid="modal-overlay" />,
}));

// ── Mock WizardChat ────────────────────────────────────────────────────

let wizardChatProps: Record<string, unknown> = {};

vi.mock("@/components/chat/WizardChat", () => ({
  WizardChat: (props: Record<string, unknown>) => {
    wizardChatProps = props;
    return <div data-testid="wizard-chat" />;
  },
}));

// ── Mock ProjectPreviewCard ────────────────────────────────────────────

vi.mock("@/features/projects/components/ProjectPreviewCard", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/projects/components/ProjectPreviewCard")
  >("@/features/projects/components/ProjectPreviewCard");
  return {
    ...actual,
    ProjectPreviewCard: ({
      config,
      onConfirm,
      onRevise,
    }: {
      config: ProjectConfig;
      onConfirm: () => void;
      onRevise: () => void;
      className?: string;
    }) => (
      <div data-testid="preview-card">
        <span data-testid="preview-name">{config.name}</span>
        <button data-testid="confirm-btn" onClick={onConfirm}>
          Create
        </button>
        <button data-testid="revise-btn" onClick={onRevise}>
          Revise
        </button>
      </div>
    ),
  };
});

// ── Mock wizardConfigExtractor ─────────────────────────────────────────

vi.mock("@/components/chat/wizardConfigExtractor", () => ({
  createConfigExtractor: () => vi.fn(),
}));

// ── Mock projectWizardPrompt ───────────────────────────────────────────

vi.mock("@/features/projects/lib/projectWizardPrompt", () => ({
  buildProjectWizardPrompt: vi.fn(() => "system prompt"),
  getTypeGuide: vi.fn(() => "type guide"),
  getProjectWizardStarters: vi.fn(() => [
    { prompt: "Build a panel", text: "New panel" },
  ]),
}));

// ── Mock indexTable ────────────────────────────────────────────────────

vi.mock("@/features/projects/lib/indexTable", () => ({
  appendRow: vi.fn(
    (content: string) =>
      content + "\n| row |",
  ),
}));

// ── Mock SectionLabel ──────────────────────────────────────────────────

vi.mock("@/components/SectionLabel", () => ({
  SectionLabel: ({ children, ...props }: { children: React.ReactNode; as?: string; className?: string }) => (
    <span {...props}>{children}</span>
  ),
  sectionLabelClass: "text-xs font-semibold uppercase tracking-wider",
}));

// ── Helpers ────────────────────────────────────────────────────────────

const mockClient = {
  call: vi.fn(),
  onEvent: vi.fn(() => vi.fn()),
} as unknown as import("@/lib/gateway/GatewayClient").GatewayClient;

const defaultProps = {
  open: true,
  agentId: "alex",
  client: mockClient,
  onClose: vi.fn(),
  onCreated: vi.fn(),
};

function renderModal(overrides?: Record<string, unknown>) {
  const props = { ...defaultProps, ...overrides };
  return render(<ProjectWizardModal {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  wizardChatProps = {};
  // Mock fetch for INDEX.md
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ content: "| Project | Doc |\n|---|---|\n| Existing | e.md |" }),
  }) as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ── Tests ──────────────────────────────────────────────────────────────

describe("slugify", () => {
  it("converts name to kebab-case slug", () => {
    expect(slugify("My Cool Project")).toBe("my-cool-project");
  });

  it("strips special characters", () => {
    expect(slugify("Hello @World! #2")).toBe("hello-world-2");
  });

  it("trims leading/trailing dashes", () => {
    expect(slugify("--leading--")).toBe("leading");
  });

  it("truncates to 60 chars", () => {
    const long = "a".repeat(100);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });
});

describe("generateMarkdown", () => {
  const config: ProjectConfig = {
    name: "Test Project",
    slug: "test-project",
    description: "A test project.",
    priority: "🟡 P1",
    type: "feature",
    phases: [
      { name: "Phase 1: Setup", tasks: ["Task A", "Task B"] },
      { name: "Phase 2: Build", tasks: ["Task C"] },
    ],
  };

  it("includes project name as heading", () => {
    const md = generateMarkdown(config);
    expect(md).toContain("# Test Project");
  });

  it("includes description as blockquote", () => {
    const md = generateMarkdown(config);
    expect(md).toContain("> A test project.");
  });

  it("includes priority", () => {
    const md = generateMarkdown(config);
    expect(md).toContain("## Priority: 🟡 P1");
  });

  it("generates checkbox tasks", () => {
    const md = generateMarkdown(config);
    expect(md).toContain("- [ ] Task A");
    expect(md).toContain("- [ ] Task B");
    expect(md).toContain("- [ ] Task C");
  });

  it("includes phase headings", () => {
    const md = generateMarkdown(config);
    expect(md).toContain("### Phase 1: Setup");
    expect(md).toContain("### Phase 2: Build");
  });

  it("includes continuation context", () => {
    const md = generateMarkdown(config);
    expect(md).toContain("## Continuation Context");
    expect(md).toContain("**Last worked on**");
    expect(md).toContain("**Immediate next step**");
    expect(md).toContain("**Context needed**");
    expect(md).toContain("**Context needed**");
  });
});

describe("ProjectWizardModal", () => {
  it("renders type select step initially", () => {
    renderModal();
    expect(screen.getByText("What kind of project?")).toBeInTheDocument();
    expect(screen.getByText("New Feature")).toBeInTheDocument();
    expect(screen.getByText("Infrastructure")).toBeInTheDocument();
    expect(screen.getByText("Research Spike")).toBeInTheDocument();
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("transitions to chat step on type select", () => {
    renderModal();
    fireEvent.click(screen.getByText("New Feature"));
    expect(screen.getByTestId("wizard-chat")).toBeInTheDocument();
  });

  it("passes client and agentId to WizardChat", () => {
    renderModal();
    fireEvent.click(screen.getByText("Infrastructure"));
    expect(wizardChatProps.client).toBe(mockClient);
    expect(wizardChatProps.agentId).toBe("alex");
    expect(wizardChatProps.wizardType).toBe("project");
  });

  it("shows back button in chat step", () => {
    renderModal();
    fireEvent.click(screen.getByText("New Feature"));
    expect(screen.getByLabelText("Go back")).toBeInTheDocument();
  });

  it("navigates back to type select", () => {
    renderModal();
    fireEvent.click(screen.getByText("New Feature"));
    fireEvent.click(screen.getByLabelText("Go back"));
    expect(screen.getByText("What kind of project?")).toBeInTheDocument();
  });

  it("shows connecting message when client is null", () => {
    renderModal({ client: null });
    fireEvent.click(screen.getByText("New Feature"));
    expect(screen.getByText("Connecting to gateway…")).toBeInTheDocument();
  });

  it("shows preview card when config is extracted", () => {
    renderModal();
    fireEvent.click(screen.getByText("New Feature"));

    // Simulate config extraction via the onConfigExtracted callback
    const onConfigExtracted = wizardChatProps.onConfigExtracted as (
      config: unknown,
    ) => void;
    act(() => {
      onConfigExtracted({
        name: "My Project",
        slug: "my-project",
        description: "Test",
        priority: "🟡 P1",
        type: "feature",
        phases: [{ name: "Phase 1", tasks: ["Do thing"] }],
      });
    });

    expect(screen.getByTestId("preview-card")).toBeInTheDocument();
    expect(screen.getByTestId("preview-name")).toHaveTextContent("My Project");
  });

  it("hides preview on revise", () => {
    renderModal();
    fireEvent.click(screen.getByText("New Feature"));

    const onConfigExtracted = wizardChatProps.onConfigExtracted as (
      config: unknown,
    ) => void;
    act(() => {
      onConfigExtracted({
        name: "My Project",
        slug: "my-project",
        description: "Test",
        priority: "🟡 P1",
        type: "feature",
        phases: [],
      });
    });

    expect(screen.getByTestId("preview-card")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("revise-btn"));
    expect(screen.queryByTestId("preview-card")).not.toBeInTheDocument();
  });

  it("creates project on confirm", async () => {
    const onCreated = vi.fn();
    const onClose = vi.fn();

    // Mock fetch sequence: INDEX.md read, file check, file write, INDEX.md read, INDEX.md write
    const fetchMock = vi
      .fn()
      // First call: fetch existing projects on mount
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: "| Project | Doc |\n|---|---|" }),
      })
      // Second call: check if file exists (404 = doesn't exist)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
      })
      // Third call: write project file
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })
      // Fourth call: read INDEX.md
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: "| Project | Doc | Status | Priority | One-liner |\n|---|---|---|---|---|",
        }),
      })
      // Fifth call: write updated INDEX.md
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    renderModal({ onCreated, onClose });
    fireEvent.click(screen.getByText("New Feature"));

    const onConfigExtracted = wizardChatProps.onConfigExtracted as (
      config: unknown,
    ) => void;
    act(() => {
      onConfigExtracted({
        name: "My New Project",
        slug: "my-new-project",
        description: "A new project",
        priority: "🟡 P1",
        type: "feature",
        phases: [{ name: "Phase 1", tasks: ["Task 1"] }],
      });
    });

    fireEvent.click(screen.getByTestId("confirm-btn"));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("shows error when project file already exists", async () => {
    const fetchMock = vi
      .fn()
      // Mount: fetch existing projects
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: "| Project | Doc |\n|---|---|" }),
      })
      // Check if file exists — it does
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: "# Existing project" }),
      });

    global.fetch = fetchMock as unknown as typeof fetch;

    renderModal();
    fireEvent.click(screen.getByText("New Feature"));

    const onConfigExtracted = wizardChatProps.onConfigExtracted as (
      config: unknown,
    ) => void;
    act(() => {
      onConfigExtracted({
        name: "Existing",
        slug: "existing",
        description: "Already exists",
        priority: "🟡 P1",
        type: "feature",
        phases: [],
      });
    });

    fireEvent.click(screen.getByTestId("confirm-btn"));

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
  });

  it("resets state when dialog reopens", () => {
    const { rerender } = render(
      <ProjectWizardModal {...defaultProps} open={false} />,
    );

    rerender(<ProjectWizardModal {...defaultProps} open={true} />);
    expect(screen.getByText("What kind of project?")).toBeInTheDocument();
  });
});
