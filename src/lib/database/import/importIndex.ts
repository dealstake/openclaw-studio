import { readWorkspaceFile } from "@/lib/workspace/resolve";
import { importFromMarkdown } from "../repositories/projectsRepo";
import type { StudioDb } from "../index";

/**
 * One-time import: reads INDEX.md for an agent and inserts all rows into the DB.
 * Idempotent — uses upsert so it can be re-run safely.
 */
export function importProjectsIndex(db: StudioDb, agentId: string): void {
  const result = readWorkspaceFile(agentId, "projects/INDEX.md");
  if (!result.content) {
    console.warn(`[importProjectsIndex] No INDEX.md found for agent ${agentId}`);
    return;
  }
  importFromMarkdown(db, result.content);
}
