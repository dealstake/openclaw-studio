import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

const GOG_ACCOUNT = process.env.GOG_ACCOUNT || "alex@tridentfundingsolutions.com";
const GOG_PATH = process.env.GOG_PATH || "/opt/homebrew/bin/gog";
const CACHE_TTL_MS = 30_000;

// When running remotely (Cloud Run), proxy to this URL to run gog on the gateway host
const ARTIFACTS_PROXY_URL = process.env.ARTIFACTS_PROXY_URL || "";

// Shared secret for machine-to-machine auth on api-internal endpoint
const ARTIFACTS_INTERNAL_KEY = process.env.ARTIFACTS_INTERNAL_KEY || "";

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
  const parsed = JSON.parse(stdout) as { files?: DriveFile[] };
  return parsed.files ?? [];
}

/**
 * Fetch files by proxying to the gateway host's artifacts endpoint.
 */
async function fetchProxy(): Promise<DriveFile[]> {
  const headers: Record<string, string> = { "Accept": "application/json" };
  if (ARTIFACTS_INTERNAL_KEY) {
    headers["X-Internal-Key"] = ARTIFACTS_INTERNAL_KEY;
  }
  const res = await fetch(ARTIFACTS_PROXY_URL, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Proxy returned ${res.status}`);
  const data = (await res.json()) as { files?: DriveFile[] };
  return data.files ?? [];
}

async function fetchDriveFiles(): Promise<DriveFile[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.files;
  }

  try {
    const canRunLocal = existsSync(GOG_PATH);
    let files: DriveFile[];

    if (canRunLocal) {
      files = await fetchLocal();
    } else if (ARTIFACTS_PROXY_URL) {
      files = await fetchProxy();
    } else {
      // No local gog and no proxy configured — surface a clear error
      throw new Error(
        "Files are not available in this environment. The gog binary was not found and ARTIFACTS_PROXY_URL is not configured. Connect to a local gateway with gog installed, or set ARTIFACTS_PROXY_URL."
      );
    }

    // Sort by modified time descending
    files.sort((a, b) => {
      const ta = new Date(a.modifiedTime).getTime();
      const tb = new Date(b.modifiedTime).getTime();
      return tb - ta;
    });

    cache = { files, fetchedAt: now };
    return files;
  } catch (err) {
    console.error("[artifacts] Failed to fetch Drive files:", err);
    if (cache) return cache.files;
    throw err;
  }
}

export async function GET(request: Request) {
  // When ARTIFACTS_INTERNAL_KEY is set, require it for incoming requests.
  // This protects the api-internal endpoint from unauthorized access.
  // Skip auth check when we're the one proxying out (i.e. gog not available locally).
  const canRunLocal = existsSync(GOG_PATH);
  if (ARTIFACTS_INTERNAL_KEY && canRunLocal) {
    const providedKey = request.headers.get("X-Internal-Key") || "";
    if (providedKey !== ARTIFACTS_INTERNAL_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const files = await fetchDriveFiles();
    return NextResponse.json({ files, count: files.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load artifacts.";
    console.error("[artifacts]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
