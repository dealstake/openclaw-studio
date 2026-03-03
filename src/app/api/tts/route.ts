/**
 * Text-to-Speech API route — proxies to ElevenLabs streaming TTS.
 *
 * POST /api/tts
 * Body: { text: string; voiceId?: string; modelId?: string }
 * Returns: audio/mpeg stream
 *
 * API key resolution order:
 * 1. ELEVENLABS_API_KEY env var
 * 2. Client-provided apiKey in body (from credential vault)
 */

import { NextResponse } from "next/server";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel — clear, professional
const DEFAULT_MODEL_ID = "eleven_flash_v2_5"; // Fast, low-latency

interface VoiceSettingsBody {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  use_speaker_boost?: boolean;
}

interface TtsRequest {
  text: string;
  voiceId?: string;
  modelId?: string;
  apiKey?: string;
  voiceSettings?: VoiceSettingsBody;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as TtsRequest;
    const { text, voiceId, modelId, apiKey: clientKey, voiceSettings } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json(
        { error: "text is required" },
        { status: 400 },
      );
    }

    // Truncate excessively long text (ElevenLabs limit ~5000 chars)
    const truncated = text.slice(0, 5000);

    const envKey = process.env.ELEVENLABS_API_KEY;
    const apiKey = envKey || (typeof clientKey === "string" && clientKey.length >= 32 ? clientKey : null);
    if (!apiKey) {
      return NextResponse.json(
        { error: "ElevenLabs API key not configured. Add it in Settings > Credentials." },
        { status: 500 },
      );
    }

    const voice = voiceId || DEFAULT_VOICE_ID;
    const model = modelId || DEFAULT_MODEL_ID;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: truncated,
          model_id: model,
          voice_settings: {
            stability: voiceSettings?.stability ?? 0.5,
            similarity_boost: voiceSettings?.similarity_boost ?? 0.75,
            style: voiceSettings?.style ?? 0.0,
            use_speaker_boost: voiceSettings?.use_speaker_boost ?? true,
          },
        }),
      },
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      console.error(`[tts] ElevenLabs returned ${response.status}: ${errText}`);
      return NextResponse.json(
        { error: `TTS failed: ${response.status}` },
        { status: response.status },
      );
    }

    // Stream the audio bytes back to the client
    return new Response(response.body, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("[tts] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
