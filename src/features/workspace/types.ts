export type WorkspaceEntry = {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  updatedAt?: number;
  /** Lazy-loaded directory contents (populated when a directory is expanded in FileTreeView) */
  children?: WorkspaceEntry[];
};

export type WorkspaceFileContent = {
  content: string | null;
  size: number;
  updatedAt: number;
  path: string;
  isText: boolean;
};

export type WorkspaceGroup = "projects" | "memory" | "brain" | "other";

/** Standard brain file names that live at the workspace root. */
const BRAIN_FILE_NAMES = new Set([
  "AGENTS.md",
  "SOUL.md",
  "TOOLS.md",
  "IDENTITY.md",
  "USER.md",
  "HEARTBEAT.md",
  "BOOTSTRAP.md",
  "MEMORY.md",
]);

/**
 * Classify a workspace entry into a display group.
 */
export const classifyEntry = (entry: WorkspaceEntry): WorkspaceGroup => {
  if (entry.path.startsWith("projects/") || entry.path === "projects") return "projects";
  if (entry.path.startsWith("memory/") || entry.path === "memory") return "memory";
  if (entry.type === "file" && BRAIN_FILE_NAMES.has(entry.name)) return "brain";
  return "other";
};
