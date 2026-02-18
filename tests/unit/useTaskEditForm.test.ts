import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTaskEditForm } from "@/features/tasks/hooks/useTaskEditForm";
import type { StudioTask } from "@/features/tasks/types";

const mockTask: StudioTask = {
  id: "task-1",
  name: "Test Task",
  description: "A test task",
  prompt: "Do something",
  model: "claude-3",
  schedule: { type: "periodic" as const, intervalMs: 3600000 },
  enabled: true,
  cronJobId: "cron-1",
  agentId: "alex",
  type: "periodic",
  deliveryChannel: null,
  deliveryTarget: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  lastRunAt: null,
  lastRunStatus: null,
  runCount: 0,
};

describe("useTaskEditForm", () => {
  it("starts in non-editing state", () => {
    const { result } = renderHook(() =>
      useTaskEditForm({ task: mockTask, onUpdateTask: vi.fn() }),
    );
    expect(result.current.editing).toBe(false);
  });

  it("populates fields when editing starts", () => {
    const { result } = renderHook(() =>
      useTaskEditForm({ task: mockTask, onUpdateTask: vi.fn() }),
    );
    act(() => result.current.startEditing());
    expect(result.current.editing).toBe(true);
    expect(result.current.editName).toBe("Test Task");
    expect(result.current.editDescription).toBe("A test task");
    expect(result.current.editPrompt).toBe("Do something");
    expect(result.current.editModel).toBe("claude-3");
  });

  it("cancels editing", () => {
    const { result } = renderHook(() =>
      useTaskEditForm({ task: mockTask, onUpdateTask: vi.fn() }),
    );
    act(() => result.current.startEditing());
    act(() => result.current.cancelEditing());
    expect(result.current.editing).toBe(false);
  });

  it("updates individual fields via setField", () => {
    const { result } = renderHook(() =>
      useTaskEditForm({ task: mockTask, onUpdateTask: vi.fn() }),
    );
    act(() => result.current.startEditing());
    act(() => result.current.setField("name", "New Name"));
    expect(result.current.editName).toBe("New Name");
    act(() => result.current.setField("description", "New desc"));
    expect(result.current.editDescription).toBe("New desc");
  });

  it("calls onUpdateTask with changed fields only", () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useTaskEditForm({ task: mockTask, onUpdateTask: onUpdate }),
    );
    act(() => result.current.startEditing());
    act(() => result.current.setField("name", "Updated Name"));
    act(() => result.current.saveEdits());
    expect(onUpdate).toHaveBeenCalledWith("task-1", { name: "Updated Name" });
    expect(result.current.editing).toBe(false);
  });

  it("does not call onUpdateTask when nothing changed", () => {
    const onUpdate = vi.fn();
    const { result } = renderHook(() =>
      useTaskEditForm({ task: mockTask, onUpdateTask: onUpdate }),
    );
    act(() => result.current.startEditing());
    act(() => result.current.saveEdits());
    expect(onUpdate).not.toHaveBeenCalled();
    expect(result.current.editing).toBe(false);
  });

  it("does nothing when startEditing called with null task", () => {
    const { result } = renderHook(() =>
      useTaskEditForm({ task: null, onUpdateTask: vi.fn() }),
    );
    act(() => result.current.startEditing());
    expect(result.current.editing).toBe(false);
  });
});
