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
import { isSidecarConfigured, sidecarMutate } from "@/lib/workspace/sidecar";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

function isValidKnowledgeFilename(filename: string): boolean {
  if (!filename || typeof filename !== "string") return false;
  if (filename.includes("/") || filename.includes("\\")) return false;
  if (filename.includes("..")) return false;
  const stem = filename.replace(/\.md$/, "");
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(stem) && filename.endsWith(".md");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateAgentBody {
  agentId: string;
  name: string;
  purpose: string;
  brainFiles?: Record<string, string>;
  knowledgeFiles?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Sidecar Mode — writes files through Mac Mini sidecar
// ---------------------------------------------------------------------------

async function createViaSidecar(body: CreateAgentBody) {
  const { agentId, name, purpose, brainFiles: customBrainFiles, knowledgeFiles } = body;

  const files: Array<[string, string]> = [
    ["SOUL.md", customBrainFiles?.soul ?? generateSoulMd(name.trim(), purpose.trim())],
    ["AGENTS.md", customBrainFiles?.agents ?? generateAgentsMd(name.trim())],
    ["HEARTBEAT.md", customBrainFiles?.heartbeat ?? generateHeartbeatMd()],
    ["MEMORY.md", customBrainFiles?.memory ?? generateMemoryMd(name.trim())],
  ];

  if (customBrainFiles?.identity) files.push(["IDENTITY.md", customBrainFiles.identity]);
  if (customBrainFiles?.user) files.push(["USER.md", customBrainFiles.user]);
  if (customBrainFiles?.persona) files.push(["PERSONA.md", customBrainFiles.persona]);

  const filesCreated: string[] = [];

  // Write brain files via sidecar PUT /file
  for (const [filename, content] of files) {
    const res = await sidecarMutate("/file", "PUT", {
      agentId: agentId.trim(),
      path: filename,
      content,
    });
    if (res.ok) {
      filesCreated.push(filename);
    } else {
      const errBody = await res.json().catch(() => ({}));
      console.error(`[agents/create] Sidecar write failed for ${filename}:`, errBody);
    }
  }

  // Write knowledge files
  if (knowledgeFiles) {
    for (const [filename, content] of Object.entries(knowledgeFiles)) {
      if (!isValidKnowledgeFilename(filename)) continue;
      const res = await sidecarMutate("/file", "PUT", {
        agentId: agentId.trim(),
        path: `knowledge/${filename}`,
        content,
      });
      if (res.ok) {
        filesCreated.push(`knowledge/${filename}`);
      }
    }
  }

  // Create memory directory by writing a placeholder
  await sidecarMutate("/file", "PUT", {
    agentId: agentId.trim(),
    path: "memory/.gitkeep",
    content: "",
  });

  return {
    ok: true,
    agentId: agentId.trim(),
    agentDir: `~/.openclaw/agents/${agentId.trim()}`,
    filesCreated,
  };
}

// ---------------------------------------------------------------------------
// Local Mode — writes files directly to filesystem
// ---------------------------------------------------------------------------

function createLocally(body: CreateAgentBody) {
  const { agentId, name, purpose, brainFiles: customBrainFiles, knowledgeFiles } = body;

  const agentDir = path.join(os.homedir(), ".openclaw", "agents", agentId.trim());

  fs.mkdirSync(agentDir, { recursive: true });
  fs.mkdirSync(path.join(agentDir, "memory"), { recursive: true });
  fs.mkdirSync(path.join(agentDir, "tasks"), { recursive: true });

  const files: Array<[string, string]> = [
    ["SOUL.md", customBrainFiles?.soul ?? generateSoulMd(name.trim(), purpose.trim())],
    ["AGENTS.md", customBrainFiles?.agents ?? generateAgentsMd(name.trim())],
    ["HEARTBEAT.md", customBrainFiles?.heartbeat ?? generateHeartbeatMd()],
    ["MEMORY.md", customBrainFiles?.memory ?? generateMemoryMd(name.trim())],
  ];

  if (customBrainFiles?.identity) files.push(["IDENTITY.md", customBrainFiles.identity]);
  if (customBrainFiles?.user) files.push(["USER.md", customBrainFiles.user]);
  if (customBrainFiles?.persona) files.push(["PERSONA.md", customBrainFiles.persona]);

  for (const [filename, content] of files) {
    const filePath = path.join(agentDir, filename);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, content, "utf-8");
    }
  }

  const knowledgeFilesCreated: string[] = [];
  if (knowledgeFiles) {
    const knowledgeDir = path.join(agentDir, "knowledge");
    fs.mkdirSync(knowledgeDir, { recursive: true });

    for (const [filename, content] of Object.entries(knowledgeFiles)) {
      if (!isValidKnowledgeFilename(filename)) continue;
      const filePath = path.join(knowledgeDir, filename);
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(path.resolve(knowledgeDir))) continue;
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content, "utf-8");
        knowledgeFilesCreated.push(`knowledge/${filename}`);
      }
    }
  }

  return {
    ok: true,
    agentId: agentId.trim(),
    agentDir,
    filesCreated: [...files.map(([f]) => f), ...knowledgeFilesCreated],
  };
}

// ─── POST /api/agents/create ─────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateAgentBody;
    const { agentId, name, purpose, knowledgeFiles } = body;

    const agentValidation = validateAgentId(agentId);
    if (!agentValidation.ok) return agentValidation.error;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required." }, { status: 400 });
    }

    if (!purpose || typeof purpose !== "string" || !purpose.trim()) {
      return NextResponse.json({ error: "purpose is required." }, { status: 400 });
    }

    if (knowledgeFiles) {
      for (const filename of Object.keys(knowledgeFiles)) {
        if (!isValidKnowledgeFilename(filename)) {
          return NextResponse.json(
            { error: `Invalid knowledge filename: "${filename}"` },
            { status: 400 },
          );
        }
      }
    }

    // Use sidecar on Cloud Run, local filesystem otherwise
    const result = isSidecarConfigured()
      ? await createViaSidecar(body)
      : createLocally(body);

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "agents/create", "Failed to create agent.");
  }
}
