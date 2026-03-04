/**
 * Text-to-Speech API route — proxies to ElevenLabs streaming TTS.
 *
 * POST /api/tts
 * Body: { text: string; voiceId?: string; modelId?: string }
 * Returns: audio/mpeg stream
 *
 * API key is resolved exclusively from ELEVENLABS_API_KEY env var.
 * Client-side keys are never accepted (security: API keys must not transit the browser).
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { parseBody } from "@/lib/api/validation";

const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel — clear, professional
const DEFAULT_MODEL_ID = "eleven_flash_v2_5"; // Fast, low-latency

const voiceSettingsSchema = z.object({
  stability: z.number().min(0).max(1).optional(),
  similarity_boost: z.number().min(0).max(1).optional(),
  style: z.number().min(0).max(1).optional(),
  use_speaker_boost: z.boolean().optional(),
}).optional();

const ttsBodySchema = z.object({
  text: z.string().min(1, "text is required").max(10000),
  voiceId: z.string().optional(),
  modelId: z.string().optional(),
  voiceSettings: voiceSettingsSchema,
});

export async function POST(request: Request): Promise<Response> {
  try {
    const { text, voiceId, modelId, voiceSettings } = await parseBody(request, ttsBodySchema);

    // Truncate excessively long text (ElevenLabs limit ~5000 chars)
    const truncated = text.slice(0, 5000);

    const apiKey = process.env.ELEVENLABS_API_KEY;
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
    // parseBody throws NextResponse on validation failure
    if (err instanceof NextResponse) return err;
    console.error("[tts] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
