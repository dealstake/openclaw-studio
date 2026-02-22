import { NextResponse } from "next/server";

import { createTaskControlPlaneBrRunner } from "@/lib/task-control-plane/br-runner";
import { handleBeadsError } from "@/lib/api/beads-error";
import { buildTaskControlPlaneSnapshot } from "@/lib/task-control-plane/read-model";
import { resolveTaskControlPlaneSshTarget } from "@/lib/task-control-plane/ssh-target";

export const runtime = "nodejs";

async function loadTaskControlPlaneRawData(): Promise<{
  scopePath: string | null;
  openIssues: unknown;
  inProgressIssues: unknown;
  blockedIssues: unknown;
  doneIssues: unknown;
}> {
  const sshTarget = resolveTaskControlPlaneSshTarget();
  const runner = createTaskControlPlaneBrRunner(sshTarget ? { sshTarget } : undefined);
  const [scope, openIssues, inProgressIssues, blockedIssues, doneIssues] = await Promise.all([
    runner.runBrJson(["where"]),
    runner.runBrJson(["list", "--status", "open", "--limit", "0"]),
    runner.runBrJson(["list", "--status", "in_progress", "--limit", "0"]),
    runner.runBrJson(["blocked", "--limit", "0"]),
    runner.runBrJson(["list", "--status", "closed", "--limit", "0"]),
  ]);
  return {
    scopePath: runner.parseScopePath(scope),
    openIssues,
    inProgressIssues,
    blockedIssues,
    doneIssues,
  };
}

export async function GET() {
  try {
    const raw = await loadTaskControlPlaneRawData();
    const snapshot = buildTaskControlPlaneSnapshot(raw);
    return NextResponse.json({ snapshot });
  } catch (err) {
    return handleBeadsError(err);
  }
}
