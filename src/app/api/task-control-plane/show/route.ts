import { NextResponse } from "next/server";

import {
  coerceBrSingleRecord,
  createTaskControlPlaneBrRunner,
} from "@/lib/task-control-plane/br-runner";
import { handleBeadsError } from "@/lib/api/beads-error";
import { resolveTaskControlPlaneSshTarget } from "@/lib/task-control-plane/ssh-target";

export const runtime = "nodejs";

const extractId = (request: Request): string => {
  let id: string | null = null;
  try {
    id = new URL(request.url).searchParams.get("id");
  } catch {
    id = null;
  }
  const trimmed = id?.trim() ?? "";
  if (!trimmed) {
    throw new Error('Missing required query parameter: "id".');
  }
  return trimmed;
};

export async function GET(request: Request) {
  try {
    const id = extractId(request);
    const sshTarget = resolveTaskControlPlaneSshTarget();
    const runner = createTaskControlPlaneBrRunner(sshTarget ? { sshTarget } : undefined);
    const raw = await runner.runBrJson(["show", id]);
    const bead = coerceBrSingleRecord(raw, { command: "show", id });
    return NextResponse.json({ bead });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message.includes('Missing required query parameter: "id"')) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    return handleBeadsError(err, "Failed to load task details.");
  }
}
