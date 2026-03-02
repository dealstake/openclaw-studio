/**
 * Voice list API route — fetches available ElevenLabs voices.
 *
 * GET /api/voice/voices
 * Returns: { voices: ElevenLabsVoice[] }
 *
 * Caches the response for 1 hour to reduce API calls.
 */

import { NextResponse } from "next/server";

interface VoiceLabel {
  accent?: string;
  description?: string;
  age?: string;
  gender?: string;
  use_case?: string;
}

interface ElevenLabsVoiceRaw {
  voice_id: string;
  name: string;
  labels: VoiceLabel;
  preview_url?: string;
  category?: string;
}

interface VoiceSummary {
  voiceId: string;
  name: string;
  gender: "male" | "female" | "neutral";
  accent: string;
  useCase: string;
  previewUrl: string | null;
}

// Simple in-memory cache
let cachedVoices: VoiceSummary[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function GET(): Promise<Response> {
  try {
    const now = Date.now();
    if (cachedVoices && now < cacheExpiry) {
      return NextResponse.json({ voices: cachedVoices });
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ElevenLabs API key not configured" },
        { status: 500 },
      );
    }

    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      headers: { "xi-api-key": apiKey },
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "Unknown error");
      console.error(`[voice/voices] ElevenLabs returned ${response.status}: ${errText}`);
      return NextResponse.json(
        { error: `Failed to fetch voices: ${response.status}` },
        { status: response.status },
      );
    }

    const data = (await response.json()) as { voices: ElevenLabsVoiceRaw[] };
    const voices: VoiceSummary[] = (data.voices ?? []).map((v) => {
      const gender = (v.labels.gender ?? "neutral").toLowerCase();
      return {
        voiceId: v.voice_id,
        name: v.name,
        gender: gender === "male" ? "male" : gender === "female" ? "female" : "neutral",
        accent: v.labels.accent ?? "",
        useCase: v.labels.use_case ?? v.labels.description ?? "",
        previewUrl: v.preview_url ?? null,
      };
    });

    // Cache it
    cachedVoices = voices;
    cacheExpiry = now + CACHE_TTL_MS;

    return NextResponse.json({ voices });
  } catch (err) {
    console.error("[voice/voices] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
