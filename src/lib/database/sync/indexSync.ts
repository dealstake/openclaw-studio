import { listAll } from "../repositories/projectsRepo";
import type { StudioDb } from "../index";

// ─── INDEX.md Format ─────────────────────────────────────────────────────────

const HEADER = `# Projects Index

| Project | Doc | Status | Priority | One-liner |
|---------|-----|--------|----------|-----------|`;

const FOOTER = `
## Status Key
- 🌊 Backlog — Raw idea, needs scoping
- 📋 Defined — Scoped and planned, ready to build
- 🔨 Active — Ready for implementation (queued for continuation agent)
- 🚧 In Progress — Continuation agent is currently building this (only ONE at a time)
- ⏸️ Parked — Intentionally deferred
- ✅ Done — Completed and verified

## Priority Key
- 🔴 P0 — Do now, blocks other work
- 🟡 P1 — Do next, important for product
- 🟢 P2 — Do when time allows, quality of life

## Session Start Instructions
When starting a new session, read this file first. For any 📋 or 🔨 project, read its file for full context. The Continuation Context section (if present) tells you exactly where to pick up.`;

/**
 * Generate INDEX.md content from the database.
 * Matches the exact format agents and parsers expect.
 */
export function generateIndexMarkdown(db: StudioDb): string {
  const rows = listAll(db);
  const tableRows = rows.map(
    (r) => `| ${r.name} | ${r.doc} | ${r.status} | ${r.priority} | ${r.oneLiner} |`
  );

  return `${HEADER}\n${tableRows.join("\n")}\n${FOOTER}\n`;
}
