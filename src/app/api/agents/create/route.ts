import { NextResponse, type NextRequest } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

import { validateAgentId, handleApiError } from "@/lib/api/helpers";
import {
  generateSoulMd,
  generateAgentsMd,
  generateHeartbeatMd,
  generateMemoryMd,
} from "@/lib/agents/templates";

export const runtime = "nodejs";

// ─── POST /api/agents/create ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      agentId: string;
      name: string;
      purpose: string;
      brainFiles?: {
        soul?: string;
        agents?: string;
        heartbeat?: string;
        memory?: string;
      };
    };

    const { agentId, name, purpose, brainFiles: customBrainFiles } = body;

    const agentValidation = validateAgentId(agentId);
    if (!agentValidation.ok) return agentValidation.error;

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

    // Write brain files — use AI-generated content if provided, fall back to templates
    const files: Array<[string, string]> = [
      ["SOUL.md", customBrainFiles?.soul ?? generateSoulMd(name.trim(), purpose.trim())],
      ["AGENTS.md", customBrainFiles?.agents ?? generateAgentsMd(name.trim())],
      ["HEARTBEAT.md", customBrainFiles?.heartbeat ?? generateHeartbeatMd()],
      ["MEMORY.md", customBrainFiles?.memory ?? generateMemoryMd(name.trim())],
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
    return handleApiError(err, "agents/create", "Failed to create agent.");
  }
}
