import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TranscriptCard } from "@/features/sessions/components/TranscriptCard";
import { ProjectCard } from "@/features/projects/components/ProjectCard";

// Mock MarkdownViewer to verify it receives correct content
vi.mock("@/components/MarkdownViewer", () => ({
  MarkdownViewer: ({ content, className }: { content: string; className?: string }) => (
    <div data-testid="markdown-viewer" data-content={content} className={className}>
      {content}
    </div>
  ),
}));

describe("TranscriptCard inline markdown", () => {
  it("renders MarkdownViewer for preview text", () => {
    const transcript = {
      sessionId: "test-session",
      sessionKey: "test-key",
      path: "/test/path",
      size: 1024,
      startedAt: new Date().toISOString(),
      model: "anthropic/claude-opus-4-6",
      preview: "Some `code` and **bold** text",
      archived: false,
      updatedAt: new Date().toISOString(),
    };

    render(<TranscriptCard transcript={transcript} />);
    const viewer = screen.getByTestId("markdown-viewer");
    expect(viewer).toBeDefined();
    expect(viewer.getAttribute("data-content")).toBe("Some `code` and **bold** text");
  });

  it("does not render MarkdownViewer when no preview", () => {
    const transcript = {
      sessionId: "test-session",
      sessionKey: "test-key",
      path: "/test/path",
      size: 1024,
      startedAt: new Date().toISOString(),
      model: "anthropic/claude-opus-4-6",
      preview: "",
      archived: false,
      updatedAt: new Date().toISOString(),
    };

    const { container } = render(<TranscriptCard transcript={transcript} />);
    expect(container.querySelector("[data-testid='markdown-viewer']")).toBeNull();
  });
});

describe("ProjectCard inline markdown", () => {
  const baseProject = {
    name: "Test Project",
    doc: "test-project.md",
    status: "Active",
    statusEmoji: "🔨" as const,
    priority: "P1",
    priorityEmoji: "🟡",
    oneLiner: "Wire `MarkdownViewer` into project cards",
    details: {
      progress: { completed: 2, total: 5, percent: 40 },
      continuation: {
        lastWorkedOn: "2026-02-18",
        nextStep: "Implement Phase 4 — inline `markdown` rendering",
        blockedBy: "Nothing",
        contextNeeded: "",
      },
      associatedTasks: [],
    },
  };

  it("renders MarkdownViewer for oneLiner", () => {
    render(
      <ProjectCard
        project={baseProject}
        onContinue={vi.fn()}
        onOpenFile={vi.fn()}
        onToggleStatus={vi.fn()}
        onArchive={vi.fn()}
      />,
    );
    const viewers = screen.getAllByTestId("markdown-viewer");
    const oneLinerViewer = viewers.find(
      (v) => v.getAttribute("data-content") === baseProject.oneLiner,
    );
    expect(oneLinerViewer).toBeDefined();
  });

  it("renders MarkdownViewer for nextStep", () => {
    render(
      <ProjectCard
        project={baseProject}
        onContinue={vi.fn()}
        onOpenFile={vi.fn()}
        onToggleStatus={vi.fn()}
        onArchive={vi.fn()}
      />,
    );
    const viewers = screen.getAllByTestId("markdown-viewer");
    const nextStepViewer = viewers.find(
      (v) => v.getAttribute("data-content") === baseProject.details.continuation.nextStep,
    );
    expect(nextStepViewer).toBeDefined();
  });
});
