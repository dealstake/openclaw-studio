import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import {
  ProjectPreviewCard,
  type ProjectConfig,
} from "@/features/projects/components/ProjectPreviewCard";

const MOCK_CONFIG: ProjectConfig = {
  name: "Session Export & Backup",
  slug: "session-export-backup",
  description: "Export sessions as JSON/Markdown/PDF with bulk backup",
  priority: "🟡 P1",
  type: "feature",
  phases: [
    {
      name: "Phase 1: Data Layer",
      tasks: ["Create export hook", "Add types"],
    },
    {
      name: "Phase 2: UI Components",
      tasks: ["Create ExportPanel", "Wire into page.tsx", "Write tests"],
    },
  ],
};

function renderCard(overrides?: Partial<Parameters<typeof ProjectPreviewCard>[0]>) {
  return render(
    <ProjectPreviewCard
      config={MOCK_CONFIG}
      onConfirm={vi.fn()}
      onRevise={vi.fn()}
      {...overrides}
    />,
  );
}

describe("ProjectPreviewCard", () => {
  it("renders project name and description", () => {
    const { container } = renderCard();
    expect(container.textContent).toContain("Session Export & Backup");
    expect(container.textContent).toContain(
      "Export sessions as JSON/Markdown/PDF with bulk backup",
    );
  });

  it("renders priority and type badges", () => {
    const { container } = renderCard();
    expect(container.textContent).toContain("P1");
    expect(container.textContent).toContain("feature");
  });

  it("renders phase and task counts", () => {
    const { container } = renderCard();
    expect(container.textContent).toContain("2 phases");
    expect(container.textContent).toContain("5 tasks");
  });

  it("calls onConfirm when Create Project button is clicked", () => {
    const onConfirm = vi.fn();
    const { container } = renderCard({ onConfirm });
    const buttons = container.querySelectorAll("button");
    const btn = Array.from(buttons).find(
      (b) => b.textContent === "Create Project",
    );
    expect(btn).toBeDefined();
    fireEvent.click(btn!);
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onRevise when Revise button is clicked", () => {
    const onRevise = vi.fn();
    const { container } = renderCard({ onRevise });
    const buttons = container.querySelectorAll("button");
    // Second button is Revise
    const reviseBtn = Array.from(buttons).find(
      (b) => b.textContent === "Revise",
    );
    expect(reviseBtn).toBeDefined();
    fireEvent.click(reviseBtn!);
    expect(onRevise).toHaveBeenCalledOnce();
  });

  it("renders all three priority variants correctly", () => {
    for (const priority of ["🔴 P0", "🟡 P1", "🟢 P2"] as const) {
      const { container, unmount } = renderCard({
        config: { ...MOCK_CONFIG, priority },
      });
      expect(container.textContent).toContain(priority.slice(2).trim());
      unmount();
    }
  });

  it("applies custom className", () => {
    const { container } = renderCard({ className: "mt-4" });
    expect(container.firstElementChild?.classList.contains("mt-4")).toBe(true);
  });
});
