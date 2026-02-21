import { NextResponse } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { TRASH_SCRIPT, RESTORE_SCRIPT } from "@/lib/agents/agent-state-scripts";
import { resolveGatewaySshTargetFromGatewayUrl, runSshJson } from "@/lib/ssh/gateway-host";
import { loadStudioSettings } from "@/lib/studio/settings-store";

export const runtime = "nodejs";

type RestoreAgentStateRequest = {
  agentId: string;
  trashDir: string;
};

const resolveAgentStateSshTarget = (): string => {
  const settings = loadStudioSettings();
  return resolveGatewaySshTargetFromGatewayUrl(settings.gateway?.url ?? "", process.env);
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }
    const { agentId } = body as Partial<{ agentId: string }>;
    const validation = validateAgentId(agentId);
    if (!validation.ok) return validation.error;

    const sshTarget = resolveAgentStateSshTarget();
    const result = runSshJson({
      sshTarget,
      argv: ["bash", "-s", "--", validation.agentId],
      input: TRASH_SCRIPT,
      label: `trash agent state (${validation.agentId})`,
    });
    return NextResponse.json({ result });
  } catch (err) {
    return handleApiError(err, "agent-state POST", "Failed to trash agent workspace/state.");
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }
    const { agentId, trashDir } = body as Partial<RestoreAgentStateRequest>;
    const validation = validateAgentId(agentId);
    if (!validation.ok) return validation.error;

    const trimmedTrash = typeof trashDir === "string" ? trashDir.trim() : "";
    if (!trimmedTrash) {
      return NextResponse.json({ error: "trashDir is required." }, { status: 400 });
    }

    const sshTarget = resolveAgentStateSshTarget();
    const result = runSshJson({
      sshTarget,
      argv: ["bash", "-s", "--", validation.agentId, trimmedTrash],
      input: RESTORE_SCRIPT,
      label: `restore agent state (${validation.agentId})`,
    });
    return NextResponse.json({ result });
  } catch (err) {
    return handleApiError(err, "agent-state PUT", "Failed to restore agent state.");
  }
}
