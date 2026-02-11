// ─── Task Metadata Store ─────────────────────────────────────────────────────
// Server-side file I/O for Studio task metadata.
// Tasks are stored per-agent at ~/.openclaw/agents/<agentId>/tasks/tasks.json
// This module runs on the server only (Node.js runtime).

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { StudioTask } from "../types";

const OPENCLAW_DIR = path.join(os.homedir(), ".openclaw");

function tasksFilePath(agentId: string): string {
  return path.join(OPENCLAW_DIR, "agents", agentId, "tasks", "tasks.json");
}

function taskStateDirPath(agentId: string, taskId: string): string {
  return path.join(OPENCLAW_DIR, "agents", agentId, "tasks", taskId);
}

export function readTasks(agentId: string): StudioTask[] {
  const filePath = tasksFilePath(agentId);
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as StudioTask[];
  } catch {
    return [];
  }
}

export function writeTasks(agentId: string, tasks: StudioTask[]): void {
  const filePath = tasksFilePath(agentId);
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(tasks, null, 2), "utf-8");
}

export function ensureTaskStateDir(agentId: string, taskId: string): void {
  const dir = taskStateDirPath(agentId, taskId);
  fs.mkdirSync(dir, { recursive: true });
  // Initialize state.json if it doesn't exist
  const stateFile = path.join(dir, "state.json");
  if (!fs.existsSync(stateFile)) {
    fs.writeFileSync(stateFile, JSON.stringify({ initialized: true, lastCheckedAt: null }, null, 2), "utf-8");
  }
}

export function removeTaskStateDir(agentId: string, taskId: string): void {
  const dir = taskStateDirPath(agentId, taskId);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Best effort
  }
}
