import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";
import { useTaskEditForm } from "@/features/tasks/hooks/useTaskEditForm";
import type { StudioTask } from "@/features/tasks/types";

afterEach(cleanup);

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<StudioTask> = {}): StudioTask {
  return {
    id: "task-1",
    cronJobId: "cron-1",
    agentId: "agent-1",
    managementStatus: "managed",
    name: "Test Task",
    description: "A description",
    type: "periodic",
    schedule: { type: "periodic", intervalMs: 3_600_000 },
    prompt: "Do something",
    model: "anthropic/claude-sonnet-4-6",
    thinking: null,
    cacheRetention: null,
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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("useTaskEditForm", () => {
  it("initializes in non-editing state", () => {
    const task = makeTask();
    const onUpdateTask = vi.fn();
    const { result } = renderHook(() =>
      useTaskEditForm({ task, onUpdateTask })
    );

    expect(result.current.editing).toBe(false);
    expect(result.current.editName).toBe("");
  });

  it("startEditing populates fields from task", () => {
    const task = makeTask({ name: "My Task", prompt: "Run this" });
    const onUpdateTask = vi.fn();
    const { result } = renderHook(() =>
      useTaskEditForm({ task, onUpdateTask })
    );

    act(() => {
      result.current.startEditing();
    });

    expect(result.current.editing).toBe(true);
    expect(result.current.editName).toBe("My Task");
    expect(result.current.editPrompt).toBe("Run this");
    expect(result.current.editDescription).toBe("A description");
    expect(result.current.editModel).toBe("anthropic/claude-sonnet-4-6");
  });

  it("startEditing does nothing when task is null", () => {
    const onUpdateTask = vi.fn();
    const { result } = renderHook(() =>
      useTaskEditForm({ task: null, onUpdateTask })
    );

    act(() => {
      result.current.startEditing();
    });

    expect(result.current.editing).toBe(false);
  });

  it("cancelEditing returns to non-editing state", () => {
    const task = makeTask();
    const onUpdateTask = vi.fn();
    const { result } = renderHook(() =>
      useTaskEditForm({ task, onUpdateTask })
    );

    act(() => result.current.startEditing());
    expect(result.current.editing).toBe(true);

    act(() => result.current.cancelEditing());
    expect(result.current.editing).toBe(false);
  });

  it("setField updates individual fields", () => {
    const task = makeTask();
    const onUpdateTask = vi.fn();
    const { result } = renderHook(() =>
      useTaskEditForm({ task, onUpdateTask })
    );

    act(() => result.current.startEditing());

    act(() => result.current.setField("name", "Updated Name"));
    expect(result.current.editName).toBe("Updated Name");

    act(() => result.current.setField("prompt", "New prompt"));
    expect(result.current.editPrompt).toBe("New prompt");

    act(() => result.current.setField("model", "new-model"));
    expect(result.current.editModel).toBe("new-model");

    act(() => result.current.setField("description", "New desc"));
    expect(result.current.editDescription).toBe("New desc");
  });

  it("saveEdits calls onUpdateTask with only changed fields", () => {
    const task = makeTask({ name: "Original", description: "Orig desc", prompt: "Orig prompt", model: "orig-model" });
    const onUpdateTask = vi.fn();
    const { result } = renderHook(() =>
      useTaskEditForm({ task, onUpdateTask })
    );

    act(() => result.current.startEditing());
    act(() => result.current.setField("name", "New Name"));
    act(() => result.current.setField("prompt", "New Prompt"));
    act(() => result.current.saveEdits());

    expect(onUpdateTask).toHaveBeenCalledWith("task-1", {
      name: "New Name",
      prompt: "New Prompt",
    });
    expect(result.current.editing).toBe(false);
  });

  it("saveEdits with no changes just cancels editing", () => {
    const task = makeTask();
    const onUpdateTask = vi.fn();
    const { result } = renderHook(() =>
      useTaskEditForm({ task, onUpdateTask })
    );

    act(() => result.current.startEditing());
    // Don't change anything
    act(() => result.current.saveEdits());

    expect(onUpdateTask).not.toHaveBeenCalled();
    expect(result.current.editing).toBe(false);
  });

  it("saveEdits trims whitespace and skips empty strings", () => {
    const task = makeTask({ name: "Original" });
    const onUpdateTask = vi.fn();
    const { result } = renderHook(() =>
      useTaskEditForm({ task, onUpdateTask })
    );

    act(() => result.current.startEditing());
    act(() => result.current.setField("name", "  New Name  "));
    act(() => result.current.setField("prompt", "   ")); // empty after trim — should NOT be included
    act(() => result.current.saveEdits());

    expect(onUpdateTask).toHaveBeenCalledWith("task-1", {
      name: "New Name",
    });
  });

  it("saveEdits does nothing when task is null", () => {
    const onUpdateTask = vi.fn();
    const { result } = renderHook(() =>
      useTaskEditForm({ task: null, onUpdateTask })
    );

    act(() => result.current.saveEdits());
    expect(onUpdateTask).not.toHaveBeenCalled();
  });
});
