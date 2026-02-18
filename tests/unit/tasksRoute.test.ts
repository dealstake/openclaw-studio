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

import { GET, POST, PATCH, DELETE } from "@/app/api/tasks/route";
import { readTasks, writeTasks } from "@/features/tasks/lib/taskStore";
import type { NextRequest } from "next/server";

const mockedReadTasks = vi.mocked(readTasks);
const mockedWriteTasks = vi.mocked(writeTasks);

function makeGetRequest(params: Record<string, string>): NextRequest {
  const url = new URL("http://localhost/api/tasks");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const req = new Request(url, { method: "GET" }) as NextRequest;
  // NextRequest adds nextUrl; simulate it for vitest
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
  name: "Test task",
  status: "active",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("GET /api/tasks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects missing agentId", async () => {
    const res = await GET(makeGetRequest({}));
    expect(res.status).toBe(400);
  });

  it("returns tasks for agent", async () => {
    mockedReadTasks.mockReturnValue([sampleTask as never]);
    const res = await GET(makeGetRequest({ agentId: "agent-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].id).toBe("task-1");
  });
});

describe("POST /api/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedReadTasks.mockReturnValue([]);
  });

  it("rejects missing task.id", async () => {
    const res = await POST(makeJsonRequest("POST", { task: { agentId: "a" } }));
    expect(res.status).toBe(400);
  });

  it("rejects missing task.agentId", async () => {
    const res = await POST(makeJsonRequest("POST", { task: { id: "t1" } }));
    expect(res.status).toBe(400);
  });

  it("creates a task", async () => {
    const res = await POST(makeJsonRequest("POST", { task: sampleTask }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.task.id).toBe("task-1");
    expect(mockedWriteTasks).toHaveBeenCalledWith("agent-1", [sampleTask]);
  });
});

describe("PATCH /api/tasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedReadTasks.mockReturnValue([{ ...sampleTask } as never]);
  });

  it("rejects missing fields", async () => {
    const res = await PATCH(makeJsonRequest("PATCH", { agentId: "agent-1" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown task", async () => {
    const res = await PATCH(makeJsonRequest("PATCH", { agentId: "agent-1", taskId: "nope", patch: { name: "x" } }));
    expect(res.status).toBe(404);
  });

  it("updates a task", async () => {
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
    mockedReadTasks.mockReturnValue([{ ...sampleTask } as never]);
  });

  it("rejects missing fields", async () => {
    const res = await DELETE(makeJsonRequest("DELETE", { agentId: "agent-1" }));
    expect(res.status).toBe(400);
  });

  it("deletes a task", async () => {
    const res = await DELETE(makeJsonRequest("DELETE", { agentId: "agent-1", taskId: "task-1" }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(mockedWriteTasks).toHaveBeenCalledWith("agent-1", []);
  });
});
