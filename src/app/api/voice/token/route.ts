/**
 * Voice token API route — generates single-use ElevenLabs tokens for
 * client-side real-time STT WebSocket connections.
 *
 * POST /api/voice/token
 * Body: { type: "realtime_scribe" | "tts_websocket", apiKey?: string }
 * Returns: { token: string }
 *
 * API key resolution: env var ELEVENLABS_API_KEY → client-provided apiKey (from credential vault)
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api/validation";

const tokenBodySchema = z.object({
  type: z.enum(["realtime_scribe", "tts_websocket"]).optional().default("realtime_scribe"),
  apiKey: z.string().optional(),
});

// Simple per-IP rate limit: max 10 tokens per hour
const tokenCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_TOKENS_PER_HOUR = 10;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = tokenCounts.get(ip);
  if (!entry || now >= entry.resetAt) {
    tokenCounts.set(ip, { count: 1, resetAt: now + 3600_000 });
    return false;
  }
  entry.count++;
  return entry.count > MAX_TOKENS_PER_HOUR;
}

function isValidApiKey(key: unknown): key is string {
  return typeof key === "string" && key.length >= 32 && /^[a-zA-Z0-9_-]+$/.test(key);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Max 10 token requests per hour." },
        { status: 429 },
      );
    }

    const body = await parseBody(request, tokenBodySchema);
    const tokenType = body.type;

    // Resolve API key: env var takes priority, client key as fallback
    const envKey = process.env.ELEVENLABS_API_KEY;
    const clientKey = body.apiKey;
    const apiKey = envKey || (isValidApiKey(clientKey) ? clientKey : null);

    if (!apiKey) {
      return NextResponse.json(
        { error: "ElevenLabs API key not configured. Add it in Settings > Credentials." },
        { status: 500 },
      );
    }

    const response = await fetch(
      `https://api.elevenlabs.io/v1/single-use-token/${tokenType}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
      },
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      console.error(`[voice/token] ElevenLabs returned ${response.status}: ${errText}`);
      return NextResponse.json(
        { error: `Token generation failed: ${response.status}` },
        { status: response.status },
      );
    }

    const data = (await response.json()) as { token: string };
    return NextResponse.json({ token: data.token });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[voice/token] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
