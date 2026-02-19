import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/tasks/lib/taskStore", () => ({
  readTasks: vi.fn(),
  writeTasks: vi.fn(),
  ensureTaskStateDir: vi.fn(),
  removeTaskStateDir: vi.fn(),
}));

vi.mock("@/lib/workspace/sidecar", () => ({
  isSidecarConfigured: vi.fn(() => false),
  sidecarGet: vi.fn(),
  sidecarMutate: vi.fn(),
  SidecarUnavailableError: class extends Error { name = "SidecarUnavailableError"; },
}));

vi.mock("@/lib/database", () => ({
  getDb: vi.fn(() => "__test_db__"),
}));

vi.mock("@/lib/database/repositories/tasksRepo", () => ({
  listByAgent: vi.fn(() => []),
  getById: vi.fn(() => null),
  upsert: vi.fn(),
  update: vi.fn(() => false),
  remove: vi.fn(() => false),
  importFromArray: vi.fn(),
}));

import { GET, POST, PATCH, DELETE } from "@/app/api/tasks/route";
import { readTasks, writeTasks } from "@/features/tasks/lib/taskStore";
import * as tasksRepo from "@/lib/database/repositories/tasksRepo";
import type { NextRequest } from "next/server";

const mockedReadTasks = vi.mocked(readTasks);
const mockedWriteTasks = vi.mocked(writeTasks);
const mockedListByAgent = vi.mocked(tasksRepo.listByAgent);
const mockedGetById = vi.mocked(tasksRepo.getById);
const mockedUpdate = vi.mocked(tasksRepo.update);

function makeGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/tasks");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const req = new Request(url, { method: "GET" }) as NextRequest;
  Object.defineProperty(req, "nextUrl", { value: url, writable: false });
  return req;
}

function makeJsonRequest(method: string, body: unknown): NextRequest {
  return new Request("http://localhost/api/tasks", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const sampleTask = {
  id: "task-1",
  agentId: "agent-1",
  cronJobId: "cron-1",
  name: "Test task",
  description: "desc",
  type: "periodic",
  schedule: { type: "periodic", intervalMs: 300000 },
  prompt: "do things",
  model: "anthropic/claude-sonnet-4-6",
  deliveryChannel: null,
  deliveryTarget: null,
  enabled: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  lastRunAt: null,
  lastRunStatus: null,
  runCount: 0,
};

describe("GET /api/tasks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects missing agentId", async () => {
    const res = await GET(makeGetRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns tasks from DB", async () => {
    mockedListByAgent.mockReturnValue([sampleTask as never]);
    const res = await GET(makeGetRequest({ agentId: "agent-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].id).toBe("task-1");
  });

  it("auto-imports from tasks.json when DB empty", async () => {
    mockedListByAgent
      .mockReturnValueOnce([]) // first call: empty
      .mockReturnValueOnce([sampleTask as never]); // after import
    mockedReadTasks.mockReturnValue([sampleTask as never]);

    const res = await GET(makeGetRequest({ agentId: "agent-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks).toHaveLength(1);
  });
});

describe("POST /api/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedListByAgent.mockReturnValue([sampleTask as never]);
  });

  it("rejects missing task.id", async () => {
    const res = await POST(makeJsonRequest("POST", { task: { agentId: "a" } }));
    expect(res.status).toBe(400);
  });

  it("rejects missing task.agentId", async () => {
    const res = await POST(makeJsonRequest("POST", { task: { id: "t1" } }));
    expect(res.status).toBe(400);
  });

  it("creates a task and syncs to file", async () => {
    const res = await POST(makeJsonRequest("POST", { task: sampleTask }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.task.id).toBe("task-1");
    expect(mockedWriteTasks).toHaveBeenCalled();
  });
});

describe("PATCH /api/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedListByAgent.mockReturnValue([sampleTask as never]);
  });

  it("rejects missing fields", async () => {
    const res = await PATCH(makeJsonRequest("PATCH", { agentId: "agent-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown task", async () => {
    mockedUpdate.mockReturnValue(false);
    const res = await PATCH(makeJsonRequest("PATCH", { agentId: "agent-1", taskId: "nope", patch: { name: "x" } }));
    expect(res.status).toBe(404);
  });

  it("updates a task", async () => {
    mockedUpdate.mockReturnValue(true);
    mockedGetById.mockReturnValue({ ...sampleTask, name: "Updated" } as never);
    const res = await PATCH(makeJsonRequest("PATCH", { agentId: "agent-1", taskId: "task-1", patch: { name: "Updated" } }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.task.name).toBe("Updated");
    expect(mockedWriteTasks).toHaveBeenCalled();
  });
});

describe("DELETE /api/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedListByAgent.mockReturnValue([]);
  });

  it("rejects missing fields", async () => {
    const res = await DELETE(makeJsonRequest("DELETE", { agentId: "agent-1" }));
    expect(res.status).toBe(400);
  });

  it("deletes a task and syncs", async () => {
    const res = await DELETE(makeJsonRequest("DELETE", { agentId: "agent-1", taskId: "task-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockedWriteTasks).toHaveBeenCalledWith("agent-1", []);
  });
});
