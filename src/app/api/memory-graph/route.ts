/**
 * GET /api/memory-graph?agentId=<id>
 *
 * Extract an entity knowledge graph from an agent's memory files:
 *   - MEMORY.md (curated long-term memory)
 *   - memory/*.md (daily logs)
 *   - projects/*.md (project context files)
 *
 * Returns nodes (entities) and edges (relations) as MemoryGraphData.
 */

import fs from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { resolveAgentWorkspace } from "@/lib/workspace/resolve";

import { extractMemoryGraph } from "@/features/memory-graph/lib/entityExtractor";
import type { MemoryFile } from "@/features/memory-graph/lib/types";

export const runtime = "nodejs";

// Maximum size of a single file to process (512 KB)
const MAX_FILE_SIZE = 512 * 1024;

/**
 * Collect markdown files from a directory (non-recursive).
 * Returns an empty array if the directory does not exist.
 */
function collectMarkdownFiles(dir: string, workspace: string): MemoryFile[] {
  if (!fs.existsSync(dir)) return [];

  const files: MemoryFile[] = [];
  let dirEntries: fs.Dirent[];
  try {
    dirEntries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }

  for (const entry of dirEntries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".md")) continue;

    const absolute = path.join(dir, entry.name);
    try {
      const stat = fs.statSync(absolute);
      if (stat.size === 0 || stat.size > MAX_FILE_SIZE) continue;
      const content = fs.readFileSync(absolute, "utf-8");
      files.push({
        path: path.relative(workspace, absolute),
        content,
        updatedAt: stat.mtimeMs,
      });
    } catch {
      // Skip unreadable files
    }
  }

  return files;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    const workspace = resolveAgentWorkspace(agentId);

    const files: MemoryFile[] = [];

    // 1. MEMORY.md (root)
    const memoryMd = path.join(workspace, "MEMORY.md");
    if (fs.existsSync(memoryMd)) {
      try {
        const stat = fs.statSync(memoryMd);
        if (stat.size > 0 && stat.size <= MAX_FILE_SIZE) {
          files.push({
            path: "MEMORY.md",
            content: fs.readFileSync(memoryMd, "utf-8"),
            updatedAt: stat.mtimeMs,
          });
        }
      } catch {
        // Skip if unreadable
      }
    }

    // 2. memory/*.md (daily logs — skip archive/)
    const memoryDir = path.join(workspace, "memory");
    files.push(...collectMarkdownFiles(memoryDir, workspace));

    // 3. projects/*.md (project context — skip archive/)
    const projectsDir = path.join(workspace, "projects");
    files.push(...collectMarkdownFiles(projectsDir, workspace));

    if (files.length === 0) {
      return NextResponse.json(
        {
          nodes: [],
          edges: [],
          stats: {
            totalFiles: 0,
            totalEntities: 0,
            totalRelations: 0,
            lastUpdated: Date.now(),
          },
        },
        { status: 200 },
      );
    }

    const graph = extractMemoryGraph(files);
    return NextResponse.json(graph);
  } catch (err) {
    return handleApiError(err, "memory-graph GET", "Failed to extract memory graph.");
  }
}
