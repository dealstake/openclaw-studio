import { STATUS_ORDER } from "./constants";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ProjectIndexRow {
  name: string;
  doc: string;
  status: string;
  statusEmoji: string;
  priority: string;
  priorityEmoji: string;
  oneLiner: string;
}

// ─── Parse INDEX.md table into structured rows ───────────────────────────────
// Retained for one-time migration imports (projectsRepo.importFromMarkdown).
// Not used in production read/write paths — the DB is the source of truth.

export function parseIndex(markdown: string): ProjectIndexRow[] {
  const lines = markdown.split("\n");
  const rows: ProjectIndexRow[] = [];

  for (const line of lines) {
    const match = line.match(
      /^\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|$/
    );
    if (!match) continue;

    const [, name, doc, status, priority, oneLiner] = match;
    if (!name || name.includes("---") || name.toLowerCase() === "project") continue;

    const statusEmoji = status.trim().match(/^(🚧|🔨|📋|🌊|⏸️|✅)/)?.[1] ?? "";
    const priorityEmoji = priority.trim().match(/^(🔴|🟡|🟢)/)?.[1] ?? "";

    rows.push({
      name: name.trim(),
      doc: doc.trim(),
      status: status.trim(),
      statusEmoji,
      priority: priority.trim(),
      priorityEmoji,
      oneLiner: oneLiner.trim(),
    });
  }

  rows.sort((a, b) => {
    const aOrder = STATUS_ORDER[a.statusEmoji] ?? 99;
    const bOrder = STATUS_ORDER[b.statusEmoji] ?? 99;
    return aOrder - bOrder;
  });

  return rows;
}
