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

  it("renders the type badge", () => {
    renderCard(makeTask({ type: "periodic" }));
    expect(screen.getByText("Periodic")).toBeDefined();
  });

  it("renders constant type badge", () => {
    renderCard(makeTask({ type: "constant", schedule: { type: "constant", intervalMs: 60_000 } }));
    expect(screen.getByText("Constant")).toBeDefined();
  });

  it("renders scheduled type badge", () => {
    renderCard(makeTask({
      type: "scheduled",
      schedule: { type: "scheduled", days: [1], times: ["09:00"], timezone: "UTC" },
    }));
    expect(screen.getByText("Scheduled")).toBeDefined();
  });

  it("renders description when present", () => {
    renderCard(makeTask({ description: "Important task" }));
    expect(screen.getByText("Important task")).toBeDefined();
  });

  it("does not render description when empty", () => {
    renderCard(makeTask({ description: "" }));
    expect(screen.queryByText("Important task")).toBeNull();
  });

  it("shows last run info when available", () => {
    renderCard(makeTask({ lastRunAt: "2026-02-17T12:00:00Z" }));
    const el = screen.getByText(/Last:/);
    expect(el).toBeDefined();
  });

  it("shows Failed badge when last run errored", () => {
    renderCard(makeTask({ lastRunAt: "2026-02-17T12:00:00Z", lastRunStatus: "error" }));
    expect(screen.getByText("Failed")).toBeDefined();
  });

  it("calls onSelect when clicked", () => {
    const onSelect = vi.fn();
    renderCard(makeTask(), { onSelect });
    fireEvent.click(screen.getByText("Test Task").closest("[role=option]")!);
    expect(onSelect).toHaveBeenCalledWith("task-abc");
  });

  it("calls onToggle when toggle is clicked", () => {
    const onToggle = vi.fn();
    const onSelect = vi.fn();
    renderCard(makeTask({ enabled: true }), { onToggle, onSelect });
    fireEvent.click(screen.getByLabelText(/Pause task/));
    expect(onToggle).toHaveBeenCalledWith("task-abc", false);
  });

  it("disables toggle when busy", () => {
    renderCard(makeTask(), { busy: true });
    const toggle = screen.getByLabelText(/Pause task/);
    expect(toggle.hasAttribute("disabled")).toBe(true);
  });

  it("shows selected styling", () => {
    const { container } = renderCard(makeTask(), { selected: true });
    const card = container.firstChild as HTMLElement;
    expect(card.className).toContain("border-primary");
  });

  it("renders schedule description", () => {
    renderCard(makeTask({ schedule: { type: "periodic", intervalMs: 900_000 } }));
    expect(screen.getByText("Every 15 min")).toBeDefined();
  });

  it("supports keyboard activation via Enter", () => {
    const onSelect = vi.fn();
    renderCard(makeTask(), { onSelect });
    const card = screen.getByText("Test Task").closest("[role=option]")!;
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("task-abc");
  });

  it("shows Resume label when task is disabled", () => {
    renderCard(makeTask({ enabled: false }));
    expect(screen.getByLabelText(/Resume task/)).toBeDefined();
  });
});
