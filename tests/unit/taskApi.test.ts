import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  fetchTasks,
  saveTaskMetadata,
  patchTaskMetadata,
  deleteTaskMetadata,
} from "@/features/tasks/lib/taskApi";
import type { StudioTask } from "@/features/tasks/types";

const mockTask: StudioTask = {
  id: "t1",
  cronJobId: "cron-1",
  agentId: "agent-1",
  name: "Test",
  description: "",
  type: "periodic",
  schedule: { type: "periodic", intervalMs: 3600000 },
  prompt: "test",
  model: "default",
  deliveryChannel: null,
  deliveryTarget: null,
  enabled: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  lastRunAt: null,
  lastRunStatus: null,
  runCount: 0,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("fetchTasks", () => {
  it("returns tasks on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tasks: [mockTask] }),
      })
    );

    const result = await fetchTasks("agent-1");
    expect(result).toEqual([mockTask]);
    expect(fetch).toHaveBeenCalledWith("/api/tasks?agentId=agent-1");
  });

  it("throws on error response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Not found" }),
      })
    );

    await expect(fetchTasks("agent-1")).rejects.toThrow("Not found");
  });

  it("returns empty array when tasks is null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ tasks: null }),
      })
    );

    const result = await fetchTasks("agent-1");
    expect(result).toEqual([]);
  });
});

describe("saveTaskMetadata", () => {
  it("posts task data", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    );

    await saveTaskMetadata(mockTask);
    expect(fetch).toHaveBeenCalledWith("/api/tasks", expect.objectContaining({ method: "POST" }));
  });

  it("throws on error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Save failed" }),
      })
    );

    await expect(saveTaskMetadata(mockTask)).rejects.toThrow("Save failed");
  });
});

describe("patchTaskMetadata", () => {
  it("returns updated task", async () => {
    const updated = { ...mockTask, name: "Updated" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ task: updated }),
      })
    );

    const result = await patchTaskMetadata("agent-1", "t1", { name: "Updated" });
    expect(result.name).toBe("Updated");
  });
});

describe("deleteTaskMetadata", () => {
  it("sends DELETE request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    );

    await deleteTaskMetadata("agent-1", "t1");
    expect(fetch).toHaveBeenCalledWith("/api/tasks", expect.objectContaining({ method: "DELETE" }));
  });
});
