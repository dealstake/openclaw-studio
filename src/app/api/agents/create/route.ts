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

// ---------------------------------------------------------------------------
// Validation Helpers
// ---------------------------------------------------------------------------

/**
 * Validate a knowledge filename — must be a simple .md filename
 * with no path separators, dots (except .md), or traversal.
 */
function isValidKnowledgeFilename(filename: string): boolean {
  if (!filename || typeof filename !== "string") return false;
  // Must end in .md, no slashes or backslashes, no ".." anywhere
  if (filename.includes("/") || filename.includes("\\")) return false;
  if (filename.includes("..")) return false;
  // Strip .md, check remaining is alphanumeric + hyphens/underscores
  const stem = filename.replace(/\.md$/, "");
  return /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(stem) && filename.endsWith(".md");
}

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
        identity?: string;
        user?: string;
        persona?: string;
      };
      /** Optional knowledge files for knowledge/ directory */
      knowledgeFiles?: Record<string, string>;
    };

    const { agentId, name, purpose, brainFiles: customBrainFiles, knowledgeFiles } = body;

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

    // Validate knowledge filenames before creating anything
    if (knowledgeFiles) {
      for (const filename of Object.keys(knowledgeFiles)) {
        if (!isValidKnowledgeFilename(filename)) {
          return NextResponse.json(
            { error: `Invalid knowledge filename: "${filename}" — must be a simple .md filename (alphanumeric, hyphens, underscores)` },
            { status: 400 },
          );
        }
      }
    }

    const agentDir = path.join(
      os.homedir(),
      ".openclaw",
      "agents",
      agentId.trim(),
    );

    // Create agent directory structure
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

    // Additional persona brain files (optional)
    if (customBrainFiles?.identity) {
      files.push(["IDENTITY.md", customBrainFiles.identity]);
    }
    if (customBrainFiles?.user) {
      files.push(["USER.md", customBrainFiles.user]);
    }
    if (customBrainFiles?.persona) {
      files.push(["PERSONA.md", customBrainFiles.persona]);
    }

    for (const [filename, content] of files) {
      const filePath = path.join(agentDir, filename);
      // Don't overwrite existing brain files
      if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, content, "utf-8");
      }
    }

    // Write knowledge files to knowledge/ subdirectory
    const knowledgeFilesCreated: string[] = [];
    if (knowledgeFiles) {
      const knowledgeDir = path.join(agentDir, "knowledge");
      fs.mkdirSync(knowledgeDir, { recursive: true });

      for (const [filename, content] of Object.entries(knowledgeFiles)) {
        const filePath = path.join(knowledgeDir, filename);
        // Verify the resolved path stays within knowledge dir (belt & suspenders)
        const resolved = path.resolve(filePath);
        if (!resolved.startsWith(path.resolve(knowledgeDir))) {
          return NextResponse.json(
            { error: `Path traversal detected in knowledge file: "${filename}"` },
            { status: 400 },
          );
        }
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, content, "utf-8");
          knowledgeFilesCreated.push(`knowledge/${filename}`);
        }
      }
    }

    return NextResponse.json({
      ok: true,
      agentId: agentId.trim(),
      agentDir,
      filesCreated: [...files.map(([f]) => f), ...knowledgeFilesCreated],
    });
  } catch (err) {
    return handleApiError(err, "agents/create", "Failed to create agent.");
  }
}
