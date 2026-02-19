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

// ─── Update a row's status by doc filename ───────────────────────────────────

export function updateRowStatus(
  indexContent: string,
  doc: string,
  newStatus: string
): { content: string; found: boolean } {
  const lines = indexContent.split("\n");
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(
      /^(\|\s*.+?\s*\|\s*)(.+?)(\s*\|\s*)(.+?)(\s*\|\s*.+?\s*\|\s*.+?\s*\|)$/
    );
    if (!match) continue;
    if (match[2].trim() !== doc) continue;

    lines[i] = `${match[1]}${match[2]}${match[3]}${newStatus}${match[5]}`;
    found = true;
    break;
  }

  return { content: lines.join("\n"), found };
}

// ─── Remove a row by doc filename ────────────────────────────────────────────

export function removeRow(
  indexContent: string,
  doc: string
): { content: string; found: boolean } {
  const lines = indexContent.split("\n");
  let found = false;

  const updatedLines = lines.filter((line) => {
    const match = line.match(
      /^\|\s*.+?\s*\|\s*(.+?)\s*\|\s*.+?\s*\|\s*.+?\s*\|\s*.+?\s*\|$/
    );
    if (match && match[1].trim() === doc) {
      found = true;
      return false;
    }
    return true;
  });

  return { content: updatedLines.join("\n"), found };
}

// ─── Append a new row to the table ───────────────────────────────────────────

export function appendRow(
  indexContent: string,
  name: string,
  doc: string,
  status: string,
  priority: string,
  oneLiner: string
): string {
  const lines = indexContent.split("\n");
  let insertIdx = -1;

  // Find the last table data row
  for (let i = lines.length - 1; i >= 0; i--) {
    if (
      lines[i].startsWith("|") &&
      !lines[i].includes("---") &&
      !lines[i].toLowerCase().includes("project")
    ) {
      insertIdx = i + 1;
      break;
    }
  }

  if (insertIdx === -1) {
    const statusKeyIdx = lines.findIndex((l) => l.startsWith("## Status Key"));
    insertIdx = statusKeyIdx > 0 ? statusKeyIdx - 1 : lines.length;
  }

  const newRow = `| ${name} | ${doc} | ${status} | ${priority} | ${oneLiner} |`;
  lines.splice(insertIdx, 0, newRow);
  return lines.join("\n");
}
