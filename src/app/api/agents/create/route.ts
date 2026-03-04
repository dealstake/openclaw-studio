import { NextResponse, type NextRequest } from "next/server";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { z } from "zod";

import { parseBody } from "@/lib/api/validation";
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
// Validation Helpers & Schemas
// ---------------------------------------------------------------------------

/** Validates knowledge filenames: alphanumeric with dashes/underscores, .md extension, no path traversal */
const knowledgeFilenameRegex = /^[a-zA-Z0-9][a-zA-Z0-9_-]*\.md$/;

function isValidKnowledgeFilename(filename: string): boolean {
  if (!filename || typeof filename !== "string") return false;
  if (filename.includes("/") || filename.includes("\\")) return false;
  if (filename.includes("..")) return false;
  return knowledgeFilenameRegex.test(filename);
}

const createAgentSchema = z.object({
  agentId: z.string().min(1),
  name: z.string().trim().min(1, "name is required"),
  purpose: z.string().trim().min(1, "purpose is required"),
  brainFiles: z.record(z.string(), z.string()).optional(),
  knowledgeFiles: z.record(z.string(), z.string()).optional(),
});

type CreateAgentBody = z.infer<typeof createAgentSchema>;

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
    const body = await parseBody(request, createAgentSchema);
    const { agentId, knowledgeFiles } = body;

    const agentValidation = validateAgentId(agentId);
    if (!agentValidation.ok) return agentValidation.error;

    // Check for existing agent to prevent slug collisions
    const agentDir = path.join(os.homedir(), ".openclaw", "agents", agentId.trim());
    if (fs.existsSync(agentDir)) {
      return NextResponse.json(
        { error: `An agent with ID "${agentId.trim()}" already exists. Please choose a different name.` },
        { status: 409 },
      );
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

    const result = isSidecarConfigured()
      ? await createViaSidecar(body)
      : createLocally(body);

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "agents/create", "Failed to create agent.");
  }
}
