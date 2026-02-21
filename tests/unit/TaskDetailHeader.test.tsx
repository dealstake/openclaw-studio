import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { TaskDetailHeader } from "@/features/tasks/components/TaskDetailHeader";

function renderHeader(overrides?: Partial<Parameters<typeof TaskDetailHeader>[0]>) {
  const defaults = {
    taskName: "Daily Heartbeat",
    editing: false,
    editName: "",
    busy: false,
    onEditNameChange: vi.fn(),
    onStartEditing: vi.fn(),
    onSaveEdits: vi.fn(),
    onCancelEditing: vi.fn(),
    onClose: vi.fn(),
  };
  return { ...render(<TaskDetailHeader {...defaults} {...overrides} />), defaults };
}

describe("TaskDetailHeader", () => {
  it("renders task name in view mode", () => {
    const { container } = renderHeader();
    expect(container.textContent).toContain("Daily Heartbeat");
  });

  it("shows edit and close buttons in view mode", () => {
    const { container } = renderHeader();
    const editBtn = container.querySelector("[aria-label='Edit task']");
    const closeBtn = container.querySelector("[aria-label='Close task detail']");
    expect(editBtn).toBeTruthy();
    expect(closeBtn).toBeTruthy();
  });

  it("shows name input and save/cancel in edit mode", () => {
    const { container } = renderHeader({
      editing: true,
      editName: "Edited Name",
    });
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("Edited Name");
    expect(container.querySelector("[aria-label='Save changes']")).toBeTruthy();
    expect(container.querySelector("[aria-label='Cancel editing']")).toBeTruthy();
  });

  it("calls onStartEditing when edit button clicked", () => {
    const { container, defaults } = renderHeader();
    const editBtn = container.querySelector("[aria-label='Edit task']") as HTMLElement;
    fireEvent.click(editBtn);
    expect(defaults.onStartEditing).toHaveBeenCalledOnce();
  });

  it("calls onClose when close button clicked", () => {
    const { container, defaults } = renderHeader();
    const closeBtn = container.querySelector("[aria-label='Close task detail']") as HTMLElement;
    fireEvent.click(closeBtn);
    expect(defaults.onClose).toHaveBeenCalledOnce();
  });

  it("calls onSaveEdits when save button clicked", () => {
    const { container, defaults } = renderHeader({
      editing: true,
      editName: "Valid Name",
    });
    const saveBtn = container.querySelector("[aria-label='Save changes']") as HTMLElement;
    fireEvent.click(saveBtn);
    expect(defaults.onSaveEdits).toHaveBeenCalledOnce();
  });

  it("disables save when busy", () => {
    const { container } = renderHeader({
      editing: true,
      editName: "Valid Name",
      busy: true,
    });
    const saveBtn = container.querySelector("[aria-label='Save changes']") as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it("disables save when name is empty", () => {
    const { container } = renderHeader({
      editing: true,
      editName: "   ",
    });
    const saveBtn = container.querySelector("[aria-label='Save changes']") as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
  });

  it("calls onCancelEditing when cancel clicked", () => {
    const { container, defaults } = renderHeader({
      editing: true,
      editName: "Something",
    });
    const cancelBtn = container.querySelector("[aria-label='Cancel editing']") as HTMLElement;
    fireEvent.click(cancelBtn);
    expect(defaults.onCancelEditing).toHaveBeenCalledOnce();
  });

  it("calls onEditNameChange on input change", () => {
    const { container, defaults } = renderHeader({
      editing: true,
      editName: "Old",
    });
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "New Name" } });
    expect(defaults.onEditNameChange).toHaveBeenCalledWith("New Name");
  });
});
