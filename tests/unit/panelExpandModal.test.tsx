import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PanelExpandModal } from "@/components/PanelExpandModal";

describe("PanelExpandModal", () => {
  it("renders children and title when open", () => {
    render(
      <PanelExpandModal open onOpenChange={vi.fn()} title="Projects">
        <div data-testid="child-content">Hello</div>
      </PanelExpandModal>
    );
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getAllByText("Projects").length).toBeGreaterThanOrEqual(1);
  });

  it("renders collapse and close buttons", () => {
    render(
      <PanelExpandModal open onOpenChange={vi.fn()} title="Test">
        <div>content</div>
      </PanelExpandModal>
    );
    expect(screen.getAllByTestId("panel-expand-close-btn").length).toBeGreaterThanOrEqual(1);
  });

  it("renders modal body container", () => {
    render(
      <PanelExpandModal open onOpenChange={vi.fn()} title="Test">
        <div>body content</div>
      </PanelExpandModal>
    );
    expect(screen.getAllByTestId("panel-expand-modal").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("body content")).toBeInTheDocument();
  });

  it("has data-panel-expand-modal attribute for keyboard shortcut guard", () => {
    render(
      <PanelExpandModal open onOpenChange={vi.fn()} title="Test">
        <div>content</div>
      </PanelExpandModal>
    );
    expect(document.querySelector("[data-panel-expand-modal]")).toBeInTheDocument();
  });
});
