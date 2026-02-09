import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

const GOG_ACCOUNT = process.env.GOG_ACCOUNT || "alex@tridentfundingsolutions.com";
const GOG_PATH = process.env.GOG_PATH || "/opt/homebrew/bin/gog";
const CACHE_TTL_MS = 30_000;

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  webViewLink?: string;
  createdTime?: string;
  parents?: string[];
}

interface CachedResult {
  files: DriveFile[];
  fetchedAt: number;
}

let cache: CachedResult | null = null;

/**
 * Parse gog CLI JSON output into DriveFile array.
 * gog drive ls --json returns { files: [...] } with fields like:
 *   id, name, mimeType, modifiedTime, size, webViewLink
 */
function parseGogOutput(stdout: string): DriveFile[] {
  const parsed = JSON.parse(stdout) as { files?: DriveFile[] };
  const files = parsed.files ?? [];
  files.sort((a, b) => {
    const ta = new Date(a.modifiedTime).getTime();
    const tb = new Date(b.modifiedTime).getTime();
    return tb - ta;
  });
  return files;
}

/**
 * Fetch files by spawning gog locally (works when Studio runs on the same machine).
 */
async function fetchLocal(): Promise<DriveFile[]> {
  const { stdout } = await execFileAsync(GOG_PATH, [
    "drive",
    "ls",
    "--account",
    GOG_ACCOUNT,
    "--json",
  ], {
    timeout: 15_000,
    env: {
      ...process.env,
      PATH: "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin",
    },
  });
  return parseGogOutput(stdout);
}

async function fetchDriveFiles(): Promise<DriveFile[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.files;
  }

  try {
    // Try local gog binary first (works when Studio runs on Mac Mini)
    const canRunLocal = existsSync(GOG_PATH);
    let files: DriveFile[];

    if (canRunLocal) {
      files = await fetchLocal();
    } else {
      // gog not available (Cloud Run deployment) — return empty with helpful message
      // Files are still accessible through the gateway's built-in Control UI
      // TODO: proxy through gateway HTTP API when available
      return [];
    }

    cache = { files, fetchedAt: now };
    return files;
  } catch (err) {
    console.error("[artifacts] Failed to fetch Drive files:", err);
    if (cache) return cache.files;
    throw err;
  }
}

export async function GET() {
  try {
    const files = await fetchDriveFiles();
    return NextResponse.json({ files, count: files.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load artifacts.";
    console.error("[artifacts]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
