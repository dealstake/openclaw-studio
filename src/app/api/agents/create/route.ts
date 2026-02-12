import { NextResponse, type NextRequest } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export const runtime = "nodejs";

// ─── Brain file templates ────────────────────────────────────────────────────

function generateSoulMd(name: string, purpose: string): string {
  return `# SOUL.md — Who ${name} Is

## Core Identity

I'm **${name}** — a specialized AI agent built for a specific mission.

## Purpose

${purpose}

## Personality

- **Focused and reliable.** I do my job well, every time.
- **Concise.** I report what matters, skip what doesn't.
- **Proactive.** If I find something important, I flag it immediately.

## Work Style

- Follow task instructions precisely
- Read state files before each run, write state back after
- Only report NEW findings (no duplicates)
- Keep reports concise and actionable

## Boundaries

- Stay within my defined scope
- Don't access data or systems outside my task requirements
- Report errors clearly instead of failing silently
`;
}

function generateAgentsMd(name: string): string {
  return `# AGENTS.md — Operating Instructions for ${name}

## Every Session

1. Read the task prompt carefully
2. Check state files for previous run data
3. Execute the task
4. Update state files
5. Report findings

## Memory

- **State files:** \`tasks/<taskId>/state.json\` — read at start, write at end
- Each run is independent — state files are your only continuity

## Safety

- Don't exfiltrate private data
- Don't run destructive commands
- Report errors clearly
- Archive over delete
`;
}

function generateHeartbeatMd(): string {
  return `# HEARTBEAT.md

This agent is task-driven. When a heartbeat fires, check for any pending work.

If nothing needs attention, reply: HEARTBEAT_OK
`;
}

function generateMemoryMd(name: string): string {
  return `# MEMORY.md — ${name}'s Long-Term Memory

_Created: ${new Date().toISOString().split("T")[0]}_

---

## About This Agent

- **Created by:** Task Wizard in openclaw-studio
- **Purpose:** See SOUL.md for mission details

## Notes

_(No notes yet — this agent will populate memories as it runs tasks.)_
`;
}

// ─── POST /api/agents/create ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      agentId: string;
      name: string;
      purpose: string;
    };

    const { agentId, name, purpose } = body;

    if (!agentId || typeof agentId !== "string" || !agentId.trim()) {
      return NextResponse.json(
        { error: "agentId is required." },
        { status: 400 },
      );
    }

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "name is required." },
        { status: 400 },
      );
    }

    if (!purpose || typeof purpose !== "string" || !purpose.trim()) {
      return NextResponse.json(
        { error: "purpose is required." },
        { status: 400 },
      );
    }

    const agentDir = path.join(
      os.homedir(),
      ".openclaw",
      "agents",
      agentId.trim(),
    );

    // Create agent directory
    fs.mkdirSync(agentDir, { recursive: true });
    fs.mkdirSync(path.join(agentDir, "memory"), { recursive: true });
    fs.mkdirSync(path.join(agentDir, "tasks"), { recursive: true });

    // Write brain files
    const files: Array<[string, string]> = [
      ["SOUL.md", generateSoulMd(name.trim(), purpose.trim())],
      ["AGENTS.md", generateAgentsMd(name.trim())],
      ["HEARTBEAT.md", generateHeartbeatMd()],
      ["MEMORY.md", generateMemoryMd(name.trim())],
    ];

    for (const [filename, content] of files) {
      const filePath = path.join(agentDir, filename);
      // Don't overwrite existing brain files
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content, "utf-8");
      }
    }

    return NextResponse.json({
      ok: true,
      agentId: agentId.trim(),
      agentDir,
      filesCreated: files.map(([f]) => f),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to create agent.";
    console.error("[agents/create] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
