/**
 * Voice list API route — fetches available ElevenLabs voices.
 *
 * GET/POST /api/voice/voices
 * Returns: { voices: VoiceSummary[] }
 *
 * Caches the response for 1 hour to reduce API calls.
 * API key resolved exclusively from ELEVENLABS_API_KEY env var.
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

// Simple in-memory cache (keyed by first 8 chars of API key to avoid cross-user leaks)
const voiceCache = new Map<string, { voices: VoiceSummary[]; expiry: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

async function fetchVoices(apiKey: string): Promise<Response> {
  const cacheKey = apiKey.slice(0, 8);
  const now = Date.now();
  const cached = voiceCache.get(cacheKey);
  if (cached && now < cached.expiry) {
    return NextResponse.json({ voices: cached.voices });
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

  voiceCache.set(cacheKey, { voices, expiry: now + CACHE_TTL_MS });
  return NextResponse.json({ voices });
}

export async function GET(): Promise<Response> {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ElevenLabs API key not configured. Add it in Settings > Credentials." },
        { status: 500 },
      );
    }
    return fetchVoices(apiKey);
  } catch (err) {
    console.error("[voice/voices] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(): Promise<Response> {
  return GET();
}
