import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { handleApiError, validateAgentId } from "@/lib/api/helpers";
import { resolveAgentWorkspace } from "@/lib/workspace/resolve";

export const runtime = "nodejs";

// ── Types ────────────────────────────────────────────────────────────────────

interface AuthProfile {
  type: string;
  provider: string;
  token: string;
  disabledUntil?: number | null;
  cooldownUntil?: number | null;
}

interface UsageStats {
  lastUsed?: number;
  errorCount?: number;
  lastFailureAt?: number;
}

interface AuthProfilesFile {
  version: number;
  profiles: Record<string, AuthProfile>;
  lastGood: Record<string, string>;
  usageStats: Record<string, UsageStats>;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function resolveAuthProfilesPath(agentId: string): string {
  const workspace = resolveAgentWorkspace(agentId);
  return path.join(workspace, "agent", "auth-profiles.json");
}

async function readAuthProfiles(filePath: string): Promise<AuthProfilesFile> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as AuthProfilesFile;
  } catch {
    return { version: 1, profiles: {}, lastGood: {}, usageStats: {} };
  }
}

async function writeAuthProfiles(
  filePath: string,
  data: AuthProfilesFile,
): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + "\n", "utf-8");
}

/** Mask a token for display: show last 4 chars only */
function maskToken(token: string): string {
  if (!token || token.length < 8) return "••••";
  return `••••••••${token.slice(-4)}`;
}

// ── Handlers ─────────────────────────────────────────────────────────────────

/**
 * GET /api/auth-profiles?agentId=<id>
 *
 * Returns masked auth profiles with usage stats. Never exposes full tokens.
 */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;

    const filePath = resolveAuthProfilesPath(validation.agentId);
    const data = await readAuthProfiles(filePath);

    // Build safe response — mask all tokens
    const profiles = Object.entries(data.profiles).map(([id, profile]) => ({
      id,
      provider: profile.provider,
      type: profile.type,
      maskedToken: maskToken(profile.token),
      disabledUntil: profile.disabledUntil ?? null,
      cooldownUntil: profile.cooldownUntil ?? null,
      isLastGood: data.lastGood[profile.provider] === id,
      usage: data.usageStats[id] ?? null,
    }));

    return NextResponse.json({ profiles });
  } catch (err) {
    return handleApiError(err, "auth-profiles GET", "Failed to read auth profiles.");
  }
}

/**
 * POST /api/auth-profiles?agentId=<id>
 *
 * Add a new auth profile.
 * Body: { id: string, provider: string, token: string }
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;

    const body = await request.json();
    const { id, provider, token } = body as {
      id?: string;
      provider?: string;
      token?: string;
    };

    if (!id || !provider || !token) {
      return NextResponse.json(
        { error: "Missing required fields: id, provider, token" },
        { status: 400 },
      );
    }

    // Validate profile ID format (alphanumeric, colons, hyphens)
    if (!/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,127}$/.test(id)) {
      return NextResponse.json(
        { error: "Invalid profile ID format." },
        { status: 400 },
      );
    }

    const filePath = resolveAuthProfilesPath(validation.agentId);
    const data = await readAuthProfiles(filePath);

    // Add the profile
    data.profiles[id] = {
      type: "token",
      provider,
      token,
    };

    // Initialize usage stats
    data.usageStats[id] = {
      lastUsed: 0,
      errorCount: 0,
    };

    // If this is the first profile for the provider, make it lastGood
    if (!data.lastGood[provider]) {
      data.lastGood[provider] = id;
    }

    await writeAuthProfiles(filePath, data);

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return handleApiError(err, "auth-profiles POST", "Failed to add auth profile.");
  }
}

/**
 * DELETE /api/auth-profiles?agentId=<id>&profileId=<profileId>
 *
 * Remove an auth profile.
 */
export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const validation = validateAgentId(url.searchParams.get("agentId"));
    if (!validation.ok) return validation.error;

    const profileId = url.searchParams.get("profileId")?.trim();
    if (!profileId) {
      return NextResponse.json(
        { error: "profileId is required." },
        { status: 400 },
      );
    }

    const filePath = resolveAuthProfilesPath(validation.agentId);
    const data = await readAuthProfiles(filePath);

    if (!data.profiles[profileId]) {
      return NextResponse.json(
        { error: `Profile not found: ${profileId}` },
        { status: 404 },
      );
    }

    const provider = data.profiles[profileId].provider;

    // Remove profile and its usage stats
    delete data.profiles[profileId];
    delete data.usageStats[profileId];

    // Update lastGood if we removed it
    if (data.lastGood[provider] === profileId) {
      const remaining = Object.entries(data.profiles).find(
        ([, p]) => p.provider === provider,
      );
      if (remaining) {
        data.lastGood[provider] = remaining[0];
      } else {
        delete data.lastGood[provider];
      }
    }

    await writeAuthProfiles(filePath, data);

    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleApiError(err, "auth-profiles DELETE", "Failed to remove auth profile.");
  }
}
