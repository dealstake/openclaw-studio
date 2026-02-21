import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { NextResponse } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { resolveAgentWorkspace } from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";

export const runtime = "nodejs";

import {
  type JsonlEntry,
  type TraceMessage,
  parseJsonlEntryToTraceMessage,
} from "@/lib/sessions/traceParser";

/**
 * GET /api/sessions/trace?agentId=<id>&sessionId=<id>&offset=0&limit=200
 *
 * Returns session transcript messages with full usage/model/stopReason data
 * by reading the raw JSONL file instead of relying on the sidecar transcript endpoint.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId")?.trim() ?? "";
    const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);
    const limit = parseInt(url.searchParams.get("limit") ?? "200", 10);

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required query parameter: sessionId" },
        { status: 400 },
      );
    }

    // Resolve sessionId: it might be a key suffix (e.g. "cron:fb40...") or a UUID.
    // If not a UUID, look up the actual UUID from sessions.json.
    const resolvedSessionId = await resolveSessionId(agentId, sessionId);

    // Try to read JSONL directly (local mode)
    if (!isSidecarConfigured()) {
      const messages = await readJsonlLocal(agentId, resolvedSessionId, offset, limit);
      return NextResponse.json({
        sessionId: resolvedSessionId,
        messages: messages.items,
        total: messages.total,
        offset,
        limit,
        hasMore: offset + limit < messages.total,
      });
    }

    // Cloud Run mode: read JSONL via sidecar /file endpoint
    const messages = await readJsonlViaSidecar(agentId, resolvedSessionId, offset, limit);
    return NextResponse.json({
      sessionId: resolvedSessionId,
      messages: messages.items,
      total: messages.total,
      offset,
      limit,
      hasMore: offset + limit < messages.total,
    });
  } catch (err) {
    return handleApiError(err, "sessions/trace", "Failed to fetch session trace.");
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Resolve a sessionId that might be a key suffix (e.g., "main", "cron:fb40...")
 * into the actual UUID used for the JSONL file.
 */
async function resolveSessionId(agentId: string, sessionId: string): Promise<string> {
  // If it's already a UUID, use it directly
  if (UUID_RE.test(sessionId)) return sessionId;

  // Otherwise, look up from sessions.json
  const workspace = resolveAgentWorkspace(agentId);
  const sessionsPath = path.join(workspace, "sessions", "sessions.json");
  if (!fs.existsSync(sessionsPath)) return sessionId;

  try {
    const raw = fs.readFileSync(sessionsPath, "utf-8");
    const data = JSON.parse(raw) as Record<string, { sessionId?: string }>;
    // Try exact key: "agent:<agentId>:<sessionId>"
    const fullKey = `agent:${agentId}:${sessionId}`;
    if (data[fullKey]?.sessionId) return data[fullKey].sessionId;
    // Fallback: scan for matching key suffix
    for (const [key, val] of Object.entries(data)) {
      if (key.endsWith(`:${sessionId}`) && val?.sessionId) return val.sessionId;
    }
  } catch {
    // Fall through
  }
  return sessionId;
}

async function readJsonlLocal(
  agentId: string,
  sessionId: string,
  offset: number,
  limit: number,
): Promise<{ items: TraceMessage[]; total: number }> {
  const workspace = resolveAgentWorkspace(agentId);

  // Check active sessions first, then archived
  const activePath = path.join(workspace, "sessions", `${sessionId}.jsonl`);
  const archivePath = path.join(workspace, "sessions", "archive", `${sessionId}.jsonl`);

  let filePath = activePath;
  if (!fs.existsSync(activePath)) {
    if (fs.existsSync(archivePath)) {
      filePath = archivePath;
    } else {
      throw new Error(`Session transcript not found: ${sessionId}`);
    }
  }

  // Stream JSONL line-by-line: count messages for total, collect only the
  // offset..offset+limit window to avoid loading entire file into memory.
  const items: TraceMessage[] = [];
  let messageIndex = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry: JsonlEntry = JSON.parse(line);
      if (entry.type !== "message" || !entry.message) continue;

      // This is a valid message — check if it falls in our window
      if (messageIndex >= offset && messageIndex < offset + limit) {
        const traced = parseJsonlEntryToTraceMessage(entry);
        if (traced) items.push(traced);
      }
      messageIndex++;
    } catch {
      // Skip malformed lines
    }
  }

  return { items, total: messageIndex };
}

async function readJsonlViaSidecar(
  agentId: string,
  sessionId: string,
  offset: number,
  limit: number,
): Promise<{ items: TraceMessage[]; total: number }> {
  // Try active path first
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
    throw new Error(`Session transcript not found: ${sessionId}`);
  }

  // Parse lazily: count total messages but only collect the window we need.
  // Note: sidecar returns full file content as a string, so we can't avoid
  // the network transfer, but we avoid parsing/allocating all TraceMessage objects.
  const lines = content.split("\n");
  const items: TraceMessage[] = [];
  let messageIndex = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry: JsonlEntry = JSON.parse(line);
      if (entry.type !== "message" || !entry.message) continue;

      if (messageIndex >= offset && messageIndex < offset + limit) {
        const traced = parseJsonlEntryToTraceMessage(entry);
        if (traced) items.push(traced);
      }
      messageIndex++;
    } catch {
      // Skip malformed lines
    }
  }

  return { items, total: messageIndex };
}
