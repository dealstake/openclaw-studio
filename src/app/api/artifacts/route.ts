import { NextResponse } from "next/server";
import { listFiles, type DriveFile, type ListFilesResult } from "@/lib/google/drive";

export const runtime = "nodejs";

const CACHE_TTL_MS = 30_000;
const ARTIFACTS_INTERNAL_KEY = process.env.ARTIFACTS_INTERNAL_KEY || "";

interface CachedResult {
  files: DriveFile[];
  fetchedAt: number;
}

let cache: CachedResult | null = null;

async function fetchDriveFiles(): Promise<DriveFile[]> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.files;
  }

  try {
    const result: ListFilesResult = await listFiles({
      pageSize: 100,
      orderBy: "modifiedTime desc",
    });

    cache = { files: result.files, fetchedAt: now };
    return result.files;
  } catch (err) {
    console.error("[artifacts] Failed to fetch Drive files:", err);
    if (cache) return cache.files;
    throw err;
  }
}

export async function GET(request: Request) {
  // Internal key auth for proxy mode
  if (ARTIFACTS_INTERNAL_KEY) {
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
