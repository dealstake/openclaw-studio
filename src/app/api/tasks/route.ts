import { NextResponse, type NextRequest } from "next/server";
import { readTasks, writeTasks, ensureTaskStateDir, removeTaskStateDir } from "@/features/tasks/lib/taskStore";
import { isSidecarConfigured, sidecarGet, sidecarMutate, SidecarUnavailableError } from "@/lib/workspace/sidecar";
import type { StudioTask, UpdateTaskPayload } from "@/features/tasks/types";

function handleSidecarError(err: unknown): NextResponse {
  if (err instanceof SidecarUnavailableError) {
    return NextResponse.json(
      { error: err.message, code: "SIDECAR_UNAVAILABLE" },
      { status: 503 }
    );
  }
  const message = err instanceof Error ? err.message : "An unexpected error occurred.";
  console.error("[tasks] error:", message);
  return NextResponse.json({ error: message }, { status: 500 });
}

export const runtime = "nodejs";

// ─── GET /api/tasks?agentId=<id> ─────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const agentId = request.nextUrl.searchParams.get("agentId")?.trim();
    if (!agentId) {
      return NextResponse.json({ error: "agentId query parameter is required." }, { status: 400 });
    }

    if (isSidecarConfigured()) {
      const resp = await sidecarGet("/tasks", { agentId });
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }

    const tasks = readTasks(agentId);
    return NextResponse.json({ tasks });
  } catch (err) {
    return handleSidecarError(err);
  }
}

// ─── POST /api/tasks — Create a task (metadata only; cron is created client-side) ─

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { task } = body as { task?: StudioTask };
    if (!task?.id || !task?.agentId) {
      return NextResponse.json({ error: "task.id and task.agentId are required." }, { status: 400 });
    }

    if (isSidecarConfigured()) {
      const resp = await sidecarMutate("/tasks", "POST", { task });
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }

    const tasks = readTasks(task.agentId);
    tasks.push(task);
    writeTasks(task.agentId, tasks);
    ensureTaskStateDir(task.agentId, task.id);

    return NextResponse.json({ task });
  } catch (err) {
    return handleSidecarError(err);
  }
}

// ─── PATCH /api/tasks — Update a task ────────────────────────────────────────

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { agentId, taskId, patch } = body as {
      agentId?: string;
      taskId?: string;
      patch?: UpdateTaskPayload;
    };
    if (!agentId || !taskId || !patch) {
      return NextResponse.json({ error: "agentId, taskId, and patch are required." }, { status: 400 });
    }

    if (isSidecarConfigured()) {
      const resp = await sidecarMutate("/tasks", "PATCH", { agentId, taskId, patch });
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }

    const tasks = readTasks(agentId);
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) {
      return NextResponse.json({ error: "Task not found." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const updated: StudioTask = { ...tasks[idx], ...patch, updatedAt: now };
    tasks[idx] = updated;
    writeTasks(agentId, tasks);

    return NextResponse.json({ task: updated });
  } catch (err) {
    return handleSidecarError(err);
  }
}

// ─── DELETE /api/tasks — Delete a task (metadata only; cron removed client-side) ─

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }
    const { agentId, taskId } = body as { agentId?: string; taskId?: string };
    if (!agentId || !taskId) {
      return NextResponse.json({ error: "agentId and taskId are required." }, { status: 400 });
    }

    if (isSidecarConfigured()) {
      const resp = await sidecarMutate("/tasks", "DELETE", { agentId, taskId });
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }

    const tasks = readTasks(agentId);
    const filtered = tasks.filter((t) => t.id !== taskId);
    writeTasks(agentId, filtered);
    removeTaskStateDir(agentId, taskId);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleSidecarError(err);
  }
}
