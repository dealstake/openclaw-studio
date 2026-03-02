/**
 * Voice token API route — generates single-use ElevenLabs tokens for
 * client-side real-time STT WebSocket connections.
 *
 * POST /api/voice/token
 * Body: { type: "realtime_scribe" | "tts_websocket" }
 * Returns: { token: string }
 */

import { NextResponse } from "next/server";

interface TokenRequest {
  type?: "realtime_scribe" | "tts_websocket";
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as TokenRequest;
    const tokenType = body.type || "realtime_scribe";

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ElevenLabs API key not configured" },
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
    console.error("[voice/token] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
