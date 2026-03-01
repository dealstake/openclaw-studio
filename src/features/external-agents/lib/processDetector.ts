/**
 * Pure utilities for detecting external agent processes from `ps aux` output.
 * No React imports — easily testable.
 */

import type { ExternalAgent, ExternalAgentType } from "./types";
import { EXTERNAL_AGENT_TYPE_META } from "./types";

/** A single row parsed from `ps aux` output */
export interface PsRow {
  user: string;
  pid: number;
  /** %CPU */
  cpu: number;
  /** %MEM */
  mem: number;
  /** Full command line */
  command: string;
  /** Working directory (from lsof — may be empty) */
  workdir?: string;
}

/**
 * Parse lines from `ps aux` (BSD format) into structured rows.
 * Skips the header line and empty lines.
 */
export function parsePsAux(rawOutput: string): PsRow[] {
  const rows: PsRow[] = [];
  const lines = rawOutput.split("\n");
  // Skip the header (first non-empty line)
  let pastHeader = false;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (!pastHeader) {
      pastHeader = true;
      continue;
    }
    // BSD ps aux columns: USER PID %CPU %MEM VSZ RSS TT STAT STARTED TIME COMMAND
    // We split on whitespace, taking the first 10 tokens; remainder = command
    const parts = line.split(/\s+/);
    if (parts.length < 11) continue;
    const pid = parseInt(parts[1], 10);
    const cpu = parseFloat(parts[2]);
    const mem = parseFloat(parts[3]);
    // Column index 10+ is the command (may include spaces)
    const command = parts.slice(10).join(" ");
    rows.push({ user: parts[0], pid, cpu, mem, command });
  }
  return rows;
}

/**
 * Given parsed ps rows, classify each process by external agent type.
 * Returns only rows that match at least one known agent type.
 */
export function classifyProcesses(
  rows: PsRow[],
): Array<{ row: PsRow; type: ExternalAgentType }> {
  const results: Array<{ row: PsRow; type: ExternalAgentType }> = [];

  for (const row of rows) {
    const cmdLower = row.command.toLowerCase();
    // Check each agent type in priority order
    const types: ExternalAgentType[] = ["claude-code", "codex", "opencode", "cursor"];
    for (const type of types) {
      const meta = EXTERNAL_AGENT_TYPE_META[type];
      const matched = meta.processPatterns.some((pattern) => cmdLower.includes(pattern));
      if (matched) {
        results.push({ row, type });
        break; // one classification per process
      }
    }
  }

  return results;
}

/**
 * Convert classified processes into `ExternalAgent` objects.
 * Deduplicates by PID — takes the first match per PID.
 */
export function buildExternalAgents(
  classified: Array<{ row: PsRow; type: ExternalAgentType }>,
  nowMs: number = Date.now(),
): ExternalAgent[] {
  const seen = new Set<number>();
  const agents: ExternalAgent[] = [];

  for (const { row, type } of classified) {
    if (seen.has(row.pid)) continue;
    seen.add(row.pid);

    agents.push({
      id: `${type}-${row.pid}`,
      type,
      status: row.cpu > 0 ? "running" : "idle",
      pid: row.pid,
      workdir: row.workdir,
      startedAt: nowMs,
    });
  }

  return agents;
}

/**
 * Full pipeline: raw `ps aux` output → `ExternalAgent[]`
 */
export function detectExternalAgentsFromPs(
  rawPsOutput: string,
  nowMs?: number,
): ExternalAgent[] {
  const rows = parsePsAux(rawPsOutput);
  const classified = classifyProcesses(rows);
  return buildExternalAgents(classified, nowMs);
}
