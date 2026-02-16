import fs from "node:fs";
import path from "node:path";

import { resolveStateDir } from "@/lib/clawdbot/paths";

const SAFE_AGENT_ID_RE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;

/**
 * Validate that an agent ID is safe for filesystem use.
 */
export const isSafeAgentId = (agentId: string): boolean =>
  SAFE_AGENT_ID_RE.test(agentId);

/**
 * Resolve the workspace root for a given agent.
 * Returns the absolute path to `~/.openclaw/agents/<agentId>/`.
 */
export const resolveAgentWorkspace = (agentId: string): string => {
  const trimmed = agentId.trim();
  if (!trimmed || !isSafeAgentId(trimmed)) {
    throw new Error(`Invalid agentId: "${trimmed}"`);
  }
  const stateDir = resolveStateDir();
  return path.join(stateDir, "agents", trimmed);
};

/**
 * Resolve and validate a relative path within an agent workspace.
 * Prevents directory traversal (../) and ensures the resolved path
 * stays within the workspace root.
 *
 * Returns the absolute resolved path.
 * Throws if the path escapes the workspace.
 */
export const resolveWorkspacePath = (
  agentId: string,
  relativePath: string
): { absolute: string; workspace: string } => {
  const workspace = resolveAgentWorkspace(agentId);
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");

  // Reject obvious traversal attempts before resolving
  if (normalized.includes("..")) {
    throw new Error("Path traversal is not allowed.");
  }

  const absolute = path.resolve(workspace, normalized);

  // Ensure the resolved path is within the workspace
  const workspaceWithSep = workspace.endsWith(path.sep)
    ? workspace
    : workspace + path.sep;
  if (absolute !== workspace && !absolute.startsWith(workspaceWithSep)) {
    throw new Error("Path escapes the agent workspace.");
  }

  return { absolute, workspace };
};

// File extensions considered safe to read/write as text
const TEXT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".csv",
  ".log",
  ".sh",
  ".bash",
  ".zsh",
  ".py",
  ".js",
  ".ts",
  ".tsx",
  ".jsx",
  ".html",
  ".css",
  ".xml",
  ".env",
  ".gitignore",
  ".dockerignore",
  "",
]);

/**
 * Check if a file extension is considered safe to read as text.
 */
export const isTextFile = (filePath: string): boolean => {
  const ext = path.extname(filePath).toLowerCase();
  // Files with no extension are assumed to be text (READMEs, Makefiles, etc.)
  return TEXT_EXTENSIONS.has(ext);
};

// Directories to exclude from listings
const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "sessions",
  "archive",
  ".DS_Store",
]);

/**
 * Check if a directory entry should be excluded from listings.
 */
export const isExcludedEntry = (name: string): boolean =>
  EXCLUDED_DIRS.has(name) || name.startsWith(".");

export type WorkspaceEntry = {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  updatedAt?: number;
};

/**
 * List entries in a workspace directory.
 * Returns files and directories (non-recursive by default).
 */
export const listWorkspaceDir = (
  agentId: string,
  relativePath: string = ""
): { entries: WorkspaceEntry[]; workspace: string } => {
  const { absolute, workspace } = resolveWorkspacePath(
    agentId,
    relativePath || ""
  );

  if (!fs.existsSync(absolute)) {
    return { entries: [], workspace };
  }

  const stat = fs.statSync(absolute);
  if (!stat.isDirectory()) {
    throw new Error(`Path is not a directory: ${relativePath}`);
  }

  const dirEntries = fs.readdirSync(absolute, { withFileTypes: true });
  const entries: WorkspaceEntry[] = [];

  for (const entry of dirEntries) {
    if (isExcludedEntry(entry.name)) continue;

    const entryAbsolute = path.join(absolute, entry.name);
    const entryRelative = path.relative(workspace, entryAbsolute);
    const isDir = entry.isDirectory();

    let size: number | undefined;
    let updatedAt: number | undefined;

    try {
      const entryStat = fs.statSync(entryAbsolute);
      size = isDir ? undefined : entryStat.size;
      updatedAt = entryStat.mtimeMs;
    } catch {
      // Skip entries we can't stat
      continue;
    }

    entries.push({
      name: entry.name,
      path: entryRelative,
      type: isDir ? "directory" : "file",
      size,
      updatedAt,
    });
  }

  // Sort: directories first, then alphabetically
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return { entries, workspace };
};

/**
 * Read a file from the workspace.
 * Returns content as string for text files, null for binary.
 */
export const readWorkspaceFile = (
  agentId: string,
  relativePath: string
): {
  content: string | null;
  size: number;
  updatedAt: number;
  path: string;
  isText: boolean;
} => {
  const { absolute, workspace } = resolveWorkspacePath(agentId, relativePath);

  if (!fs.existsSync(absolute)) {
    throw new Error(`File not found: ${relativePath}`);
  }

  const stat = fs.statSync(absolute);
  if (!stat.isFile()) {
    throw new Error(`Path is not a file: ${relativePath}`);
  }

  // Limit readable file size to 1MB
  const MAX_SIZE = 1024 * 1024;
  const isText = isTextFile(absolute);

  return {
    content: isText && stat.size <= MAX_SIZE
      ? fs.readFileSync(absolute, "utf-8")
      : null,
    size: stat.size,
    updatedAt: stat.mtimeMs,
    path: path.relative(workspace, absolute),
    isText,
  };
};

/**
 * Write content to a file in the workspace.
 * Creates parent directories if needed.
 */
export const writeWorkspaceFile = (
  agentId: string,
  relativePath: string,
  content: string
): { path: string; size: number } => {
  const { absolute, workspace } = resolveWorkspacePath(agentId, relativePath);

  // Ensure parent directory exists
  const dir = path.dirname(absolute);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(absolute, content, "utf-8");
  const stat = fs.statSync(absolute);

  return {
    path: path.relative(workspace, absolute),
    size: stat.size,
  };
};
