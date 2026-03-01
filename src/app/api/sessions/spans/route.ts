import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { NextResponse } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { resolveAgentWorkspace } from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";
import type { JsonlEntry } from "@/lib/sessions/traceParser";
import { parseSpansFromJsonl } from "@/features/sessions/lib/spanParser";

export const runtime = "nodejs";

/**
 * GET /api/sessions/spans?agentId=<id>&sessionId=<id>[&turnIndex=<n>]
 *
 * Derives request-level LLM trace spans from the session JSONL transcript.
 * Returns structured span data for the SpanWaterfallView (Phase 2).
 *
 * Optional query params:
 *   turnIndex — if provided, filter to spans for that specific turn only
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId")?.trim() ?? "";
    const turnIndexParam = url.searchParams.get("turnIndex");
    const turnIndexFilter = turnIndexParam !== null ? parseInt(turnIndexParam, 10) : null;

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required query parameter: sessionId" },
        { status: 400 },
      );
    }

    const resolvedSessionId = await resolveSessionId(agentId, sessionId);

    let entries: JsonlEntry[];

    if (!isSidecarConfigured()) {
      entries = await readAllEntriesLocal(agentId, resolvedSessionId);
    } else {
      entries = await readAllEntriesViaSidecar(agentId, resolvedSessionId);
    }

    const result = parseSpansFromJsonl(entries, resolvedSessionId);

    // Optional turn-level filter
    if (turnIndexFilter !== null && !isNaN(turnIndexFilter)) {
      result.spans = result.spans.filter((s) => s.turnIndex === turnIndexFilter);
    }

    return NextResponse.json(result);
  } catch (err) {
    return handleApiError(err, "sessions/spans", "Failed to derive session spans.");
  }
}

// ─── Session ID resolution (mirrors /api/sessions/trace/route.ts) ──────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveSessionId(agentId: string, sessionId: string): Promise<string> {
  if (UUID_RE.test(sessionId)) return sessionId;

  const compositePrefix = `agent:${agentId}:`;
  const normalizedId = sessionId.startsWith(compositePrefix)
    ? sessionId.slice(compositePrefix.length)
    : sessionId;

  if (UUID_RE.test(normalizedId)) return normalizedId;

  const workspace = resolveAgentWorkspace(agentId);
  const sessionsPath = path.join(workspace, "sessions", "sessions.json");
  if (!fs.existsSync(sessionsPath)) return normalizedId;

  try {
    const raw = fs.readFileSync(sessionsPath, "utf-8");
    const data = JSON.parse(raw) as Record<string, { sessionId?: string }>;

    if (data[sessionId]?.sessionId) return data[sessionId].sessionId;

    const fullKey = `agent:${agentId}:${normalizedId}`;
    if (data[fullKey]?.sessionId) return data[fullKey].sessionId;

    for (const [key, val] of Object.entries(data)) {
      if (key.startsWith(compositePrefix) && key.endsWith(`:${normalizedId}`) && val?.sessionId) {
        return val.sessionId;
      }
    }
  } catch {
    // Fall through
  }
  return normalizedId;
}

// ─── JSONL readers ────────────────────────────────────────────────────────

/** Maximum sidecar file size (10 MB) to guard against OOM. */
const MAX_SIDECAR_FILE_SIZE = 10 * 1024 * 1024;

async function readAllEntriesLocal(agentId: string, sessionId: string): Promise<JsonlEntry[]> {
  const workspace = resolveAgentWorkspace(agentId);
  const activePath = path.join(workspace, "sessions", `${sessionId}.jsonl`);
  const archivePath = path.join(workspace, "sessions", "archive", `${sessionId}.jsonl`);

  let filePath = activePath;
  if (!fs.existsSync(activePath)) {
    if (fs.existsSync(archivePath)) {
      filePath = archivePath;
    } else {
      throw new Error(
        `Session transcript not found for "${sessionId}". The session may have been archived or deleted.`,
      );
    }
  }

  const entries: JsonlEntry[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as JsonlEntry);
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}

async function readAllEntriesViaSidecar(
  agentId: string,
  sessionId: string,
): Promise<JsonlEntry[]> {
  const activePath = `sessions/${sessionId}.jsonl`;
  const archivePath = `sessions/archive/${sessionId}.jsonl`;

  let content: string | null = null;
  for (const filePath of [activePath, archivePath]) {
    try {
      const resp = await sidecarGet("/file", { agentId, path: filePath });
      if (resp.ok) {
        const data = await resp.json();
        content = data.content;
        break;
      }
    } catch {
      // Try next path
    }
  }

  if (content === null) {
    throw new Error(
      `Session transcript not found for "${sessionId}". The session may have been archived or deleted.`,
    );
  }

  if (content.length > MAX_SIDECAR_FILE_SIZE) {
    throw new Error(
      `Session transcript too large (${Math.round(content.length / 1024 / 1024)}MB). ` +
        `Maximum supported size is ${MAX_SIDECAR_FILE_SIZE / 1024 / 1024}MB.`,
    );
  }

  const entries: JsonlEntry[] = [];
  for (const line of content.split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as JsonlEntry);
    } catch {
      // Skip malformed lines
    }
  }

  return entries;
}
