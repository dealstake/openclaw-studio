import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectCard } from "@/features/projects/components/ProjectCard";

// Mock MarkdownViewer to verify it receives correct content
vi.mock("@/components/MarkdownViewer", () => ({
  MarkdownViewer: ({ content, className }: { content: string; className?: string }) => (
    <div data-testid="markdown-viewer" data-content={content} className={className}>
      {content}
    </div>
  ),
}));

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
      planItems: [],
      history: [],
    },
  };

  it("renders MarkdownViewer for oneLiner", () => {
    render(
      <ProjectCard
        project={baseProject}
        onOpenFile={vi.fn()}
        onChangeStatus={vi.fn()}
        onArchive={vi.fn()}
        buildingCount={0}
        queuePosition={0}
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
        onOpenFile={vi.fn()}
        onChangeStatus={vi.fn()}
        onArchive={vi.fn()}
        buildingCount={0}
        queuePosition={0}
      />,
    );
    const viewers = screen.getAllByTestId("markdown-viewer");
    const nextStepViewer = viewers.find(
      (v) => v.getAttribute("data-content") === baseProject.details.continuation.nextStep,
    );
    expect(nextStepViewer).toBeDefined();
  });
});
