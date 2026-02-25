import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EmergencyConfirmDialog } from "@/features/emergency/components/EmergencyConfirmDialog";

const getInput = () => screen.getByRole("textbox");
const getConfirmBtn = () => {
  const buttons = screen.getAllByRole("button");
  return buttons.find((b) => b.textContent === "PAUSE")!;
};

describe("EmergencyConfirmDialog", () => {
  const baseProps = {
    open: true,
    onOpenChange: vi.fn(),
    title: "Pause All Cron?",
    description: "This will disable all cron jobs.",
    confirmWord: "PAUSE",
    destructive: false,
    onConfirm: vi.fn(),
  };

  it("renders title and description", () => {
    render(<EmergencyConfirmDialog {...baseProps} />);
    expect(screen.getByText("Pause All Cron?")).toBeInTheDocument();
    expect(screen.getByText("This will disable all cron jobs.")).toBeInTheDocument();
  });

  it("disables confirm button when input doesn't match", () => {
    render(<EmergencyConfirmDialog {...baseProps} />);
    expect(getConfirmBtn()).toBeDisabled();
  });

  it("enables confirm button when input matches (case-insensitive)", () => {
    render(<EmergencyConfirmDialog {...baseProps} />);
    fireEvent.change(getInput(), { target: { value: "pause" } });
    expect(getConfirmBtn()).not.toBeDisabled();
  });

  it("calls onConfirm when button clicked with matching input", () => {
    render(<EmergencyConfirmDialog {...baseProps} />);
    fireEvent.change(getInput(), { target: { value: "PAUSE" } });
    fireEvent.click(getConfirmBtn());
    expect(baseProps.onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm on Enter key with matching input", () => {
    const onConfirm = vi.fn();
    render(<EmergencyConfirmDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.change(getInput(), { target: { value: "PAUSE" } });
    fireEvent.keyDown(getInput(), { key: "Enter" });
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not call onConfirm on Enter when input doesn't match", () => {
    const onConfirm = vi.fn();
    render(<EmergencyConfirmDialog {...baseProps} onConfirm={onConfirm} />);
    fireEvent.change(getInput(), { target: { value: "WRONG" } });
    fireEvent.keyDown(getInput(), { key: "Enter" });
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
