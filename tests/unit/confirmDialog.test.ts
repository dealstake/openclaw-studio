import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

afterEach(cleanup);

function renderDialog(props: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  return render(
    createElement(ConfirmDialog, {
      open: true,
      onOpenChange: () => {},
      title: "Delete item?",
      description: "This action cannot be undone.",
      onConfirm: () => {},
      ...props,
    })
  );
}

describe("ConfirmDialog", () => {
  it("renders title and description when open", () => {
    renderDialog();
    expect(screen.getByText("Delete item?")).toBeDefined();
    expect(screen.getByText("This action cannot be undone.")).toBeDefined();
  });

  it("does not render content when closed", () => {
    renderDialog({ open: false });
    expect(screen.queryByText("Delete item?")).toBeNull();
  });

  it("renders default button labels", () => {
    renderDialog();
    expect(screen.getByText("Cancel")).toBeDefined();
    expect(screen.getByText("Confirm")).toBeDefined();
  });

  it("renders custom button labels", () => {
    renderDialog({ confirmLabel: "Delete", cancelLabel: "Keep" });
    expect(screen.getByText("Delete")).toBeDefined();
    expect(screen.getByText("Keep")).toBeDefined();
  });

  it("calls onConfirm when confirm button clicked", () => {
    const onConfirm = vi.fn();
    renderDialog({ onConfirm });
    fireEvent.click(screen.getByText("Confirm"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onOpenChange when cancel button clicked", () => {
    const onOpenChange = vi.fn();
    renderDialog({ onOpenChange });
    fireEvent.click(screen.getByText("Cancel"));
    // Radix AlertDialog.Cancel triggers onOpenChange(false)
    expect(onOpenChange).toHaveBeenCalled();
  });

  it("applies destructive styling when destructive=true", () => {
    renderDialog({ destructive: true, confirmLabel: "Delete" });
    const btn = screen.getByText("Delete");
    expect(btn.className).toContain("destructive");
  });

  it("applies primary styling when destructive=false", () => {
    renderDialog({ destructive: false });
    const btn = screen.getByText("Confirm");
    expect(btn.className).toContain("primary");
  });
});
