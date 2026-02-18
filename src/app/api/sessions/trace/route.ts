import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { NextResponse } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { resolveAgentWorkspace } from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";

export const runtime = "nodejs";

type JsonlEntry = {
  type: string;
  id?: string;
  parentId?: string | null;
  timestamp?: string;
  message?: {
    role: string;
    content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
    usage?: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
      totalTokens: number;
      cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
    };
    model?: string;
    stopReason?: string;
    timestamp?: string;
  };
  [key: string]: unknown;
};

type TraceMessage = {
  id: string;
  role: string;
  content: string | Array<{ type: string; text?: string; [key: string]: unknown }>;
  timestamp: string;
  usage?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    totalTokens: number;
    cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
  };
  model?: string;
  stopReason?: string;
};

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

    // Try to read JSONL directly (local mode)
    if (!isSidecarConfigured()) {
      const messages = await readJsonlLocal(agentId, sessionId, offset, limit);
      return NextResponse.json({
        sessionId,
        messages: messages.items,
        total: messages.total,
        offset,
        limit,
        hasMore: offset + limit < messages.total,
      });
    }

    // Cloud Run mode: read JSONL via sidecar /file endpoint
    const messages = await readJsonlViaSidecar(agentId, sessionId, offset, limit);
    return NextResponse.json({
      sessionId,
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

function parseJsonlMessages(lines: string[]): TraceMessage[] {
  const messages: TraceMessage[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const entry: JsonlEntry = JSON.parse(line);
      if (entry.type !== "message" || !entry.message) continue;
      const msg = entry.message;
      messages.push({
        id: entry.id ?? crypto.randomUUID(),
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp ?? entry.timestamp ?? "",
        ...(msg.usage ? { usage: msg.usage } : {}),
        ...(msg.model ? { model: msg.model } : {}),
        ...(msg.stopReason ? { stopReason: msg.stopReason } : {}),
      });
    } catch {
      // Skip malformed lines
    }
  }
  return messages;
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

  // Read and parse all message-type entries
  const allLines: string[] = [];
  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    allLines.push(line);
  }

  const allMessages = parseJsonlMessages(allLines);
  const items = allMessages.slice(offset, offset + limit);
  return { items, total: allMessages.length };
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

  const lines = content.split("\n");
  const allMessages = parseJsonlMessages(lines);
  const items = allMessages.slice(offset, offset + limit);
  return { items, total: allMessages.length };
}
