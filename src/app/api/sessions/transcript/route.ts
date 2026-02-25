import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { NextResponse } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { resolveAgentWorkspace } from "@/lib/workspace/resolve";
import { isSidecarConfigured, sidecarGet } from "@/lib/workspace/sidecar";

export const runtime = "nodejs";

/**
 * GET /api/sessions/transcript?agentId=<id>&sessionId=<id>&offset=0&limit=100
 *
 * Fetch messages from a specific session transcript (active or archived).
 * Uses sidecar when configured, falls back to local JSONL reading.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId")?.trim() ?? "";
    const offset = url.searchParams.get("offset") ?? "0";
    const limit = url.searchParams.get("limit") ?? "100";

    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;
    const { agentId } = validation;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing required query parameter: sessionId" },
        { status: 400 },
      );
    }

    if (isSidecarConfigured()) {
      const resp = await sidecarGet("/sessions/transcript", {
        agentId,
        sessionId,
        offset,
        limit,
      });
      const data = await resp.json();
      return NextResponse.json(data, { status: resp.status });
    }

    // Local fallback: read JSONL file directly
    const messages = await readTranscriptLocal(
      agentId,
      sessionId,
      parseInt(offset, 10),
      parseInt(limit, 10),
    );
    return NextResponse.json(messages);
  } catch (err) {
    return handleApiError(err, "sessions/transcript", "Failed to fetch transcript.");
  }
}

type TranscriptMessage = {
  id: string;
  role: string;
  content: string | unknown[];
  timestamp: string;
};

async function readTranscriptLocal(
  agentId: string,
  sessionId: string,
  offset: number,
  limit: number,
): Promise<{ sessionId: string; messages: TranscriptMessage[]; total: number; offset: number; limit: number; hasMore: boolean }> {
  const workspace = resolveAgentWorkspace(agentId);
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

  const messages: TranscriptMessage[] = [];
  let messageIndex = 0;

  const rl = readline.createInterface({
    input: fs.createReadStream(filePath, { encoding: "utf-8" }),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      if (entry.type !== "message" || !entry.message) continue;

      if (messageIndex >= offset && messageIndex < offset + limit) {
        messages.push({
          id: entry.message.id ?? `msg-${messageIndex}`,
          role: entry.message.role ?? "unknown",
          content: entry.message.content ?? "",
          timestamp: entry.timestamp ?? "",
        });
      }
      messageIndex++;
    } catch {
      // Skip malformed lines
    }
  }

  return {
    sessionId,
    messages,
    total: messageIndex,
    offset,
    limit,
    hasMore: offset + limit < messageIndex,
  };
}
