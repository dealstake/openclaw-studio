import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SettingsListItem } from "@/features/agents/components/SettingsListItem";

describe("SettingsListItem", () => {
  const baseProps = () => ({
    id: "job-1",
    title: "My Cron Job",
    metadata: <div>Every 5 minutes</div>,
    runLabel: "Run job now",
    deleteLabel: "Delete job",
    onRun: vi.fn(),
    onDelete: vi.fn(),
  });

  it("renders title and metadata", () => {
    render(<SettingsListItem {...baseProps()} />);
    expect(screen.getByText("My Cron Job")).toBeInTheDocument();
    expect(screen.getByText("Every 5 minutes")).toBeInTheDocument();
  });

  it("calls onRun when play button clicked", () => {
    const props = baseProps();
    const { container } = render(<SettingsListItem {...props} />);
    const btn = container.querySelector('button[aria-label="Run job now"]')!;
    fireEvent.click(btn);
    expect(props.onRun).toHaveBeenCalledOnce();
  });

  it("calls onDelete when delete button clicked", () => {
    const props = baseProps();
    const { container } = render(<SettingsListItem {...props} />);
    const btn = container.querySelector('button[aria-label="Delete job"]')!;
    fireEvent.click(btn);
    expect(props.onDelete).toHaveBeenCalledOnce();
  });

  it("disables buttons when runBusy", () => {
    const { container } = render(<SettingsListItem {...baseProps()} runBusy />);
    const run = container.querySelector('button[aria-label="Run job now"]') as HTMLButtonElement;
    const del = container.querySelector('button[aria-label="Delete job"]') as HTMLButtonElement;
    expect(run.disabled).toBe(true);
    expect(del.disabled).toBe(true);
  });

  it("disables buttons when deleteBusy", () => {
    const { container } = render(<SettingsListItem {...baseProps()} deleteBusy />);
    const run = container.querySelector('button[aria-label="Run job now"]') as HTMLButtonElement;
    const del = container.querySelector('button[aria-label="Delete job"]') as HTMLButtonElement;
    expect(run.disabled).toBe(true);
    expect(del.disabled).toBe(true);
  });

  it("disables delete when deleteAllowed is false", () => {
    const { container } = render(<SettingsListItem {...baseProps()} deleteAllowed={false} />);
    const run = container.querySelector('button[aria-label="Run job now"]') as HTMLButtonElement;
    const del = container.querySelector('button[aria-label="Delete job"]') as HTMLButtonElement;
    expect(run.disabled).toBe(false);
    expect(del.disabled).toBe(true);
  });
});
