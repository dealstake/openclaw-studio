import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import type { StudioTask } from "@/features/tasks/types";

afterEach(cleanup);

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<StudioTask> = {}): StudioTask {
  return {
    id: "task-abc",
    cronJobId: "cron-123",
    agentId: "agent-1",
    managementStatus: "managed",
    name: "Test Task",
    description: "A test task description",
    type: "periodic",
    schedule: { type: "periodic", intervalMs: 3_600_000 },
    prompt: "Do something",
    model: "anthropic/claude-sonnet-4-6",
    thinking: null,
    deliveryChannel: null,
    deliveryTarget: null,
    enabled: true,
    createdAt: "2026-02-17T00:00:00Z",
    updatedAt: "2026-02-17T00:00:00Z",
    lastRunAt: null,
    lastRunStatus: null,
    runCount: 0,
    ...overrides,
  };
}

const noop = () => {};

function renderCard(task: StudioTask, props: Partial<Parameters<typeof TaskCard>[0]> = {}) {
  return render(
    createElement(TaskCard, {
      task,
      busy: false,
      selected: false,
      onSelect: noop,
      onToggle: noop,
      ...props,
    })
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("TaskCard", () => {
  it("renders the task name", () => {
    renderCard(makeTask({ name: "My Cool Task" }));
    expect(screen.getByText("My Cool Task")).toBeDefined();
  });

  it("renders description when present", () => {
    renderCard(makeTask({ description: "Important task" }));
    expect(screen.getByText("Important task")).toBeDefined();
  });

  it("does not render description when empty", () => {
    renderCard(makeTask({ description: "" }));
    expect(screen.queryByText("Important task")).toBeNull();
  });

  it("shows error icon and relative time for error state", () => {
    renderCard(makeTask({ lastRunAt: "2026-02-17T12:00:00Z", lastRunStatus: "error" }));
    // Error state shows XCircle icon (with text-destructive class) + relative time, not "Last run failed" text
    const errorIcon = document.querySelector(".text-destructive");
    expect(errorIcon).toBeDefined();
  });

  it("shows Paused status when disabled", () => {
    renderCard(makeTask({ enabled: false }));
    expect(screen.getByText("Paused")).toBeDefined();
  });

  it("shows Running status when running", () => {
    renderCard(makeTask({ runningAtMs: Date.now() }));
    expect(screen.getByText("Running…")).toBeDefined();
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    renderCard(makeTask(), { onSelect });
    fireEvent.click(screen.getByText("Test Task").closest("[role=option]")!);
    expect(onSelect).toHaveBeenCalledWith("task-abc");
  });

  it("shows selected styling", () => {
    const { container } = renderCard(makeTask(), { selected: true });
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("border-primary");
  });

  it("supports keyboard activation via Enter", () => {
    const onSelect = vi.fn();
    renderCard(makeTask(), { onSelect });
    const card = screen.getByText("Test Task").closest("[role=option]")!;
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("task-abc");
  });

  it("has aria-label with task name and status", () => {
    const { container } = renderCard(makeTask({ name: "My Task", enabled: true }));
    const card = container.firstChild as HTMLElement;
    expect(card.getAttribute("aria-label")).toContain("My Task");
    expect(card.getAttribute("aria-label")).toContain("Active");
  });

  it("does not render inline toggle (toggle moved to drawer)", () => {
    renderCard(makeTask({ enabled: true }));
    expect(screen.queryByLabelText(/Pause task/)).toBeNull();
    expect(screen.queryByLabelText(/Resume task/)).toBeNull();
  });

  it("does not render type badge (simplified card)", () => {
    renderCard(makeTask({ type: "periodic" }));
    expect(screen.queryByText("Periodic")).toBeNull();
  });
});
