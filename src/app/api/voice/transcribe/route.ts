/**
 * Voice transcription API route — proxies audio to ElevenLabs Scribe STT (REST).
 *
 * POST /api/voice/transcribe
 * Body: multipart/form-data with "audio" file (webm, mp4, ogg, wav)
 * Returns: { transcript: string, language?: string }
 *
 * API key resolved exclusively from ELEVENLABS_API_KEY env var.
 *
 * This server-side approach avoids browser WebSocket bugs (iOS Safari gesture
 * chains, React re-render killing connections, stale closure issues).
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10MB
const STT_MODEL_ID = "scribe_v2";
const STT_ENDPOINT = "https://api.elevenlabs.io/v1/speech-to-text";

// Simple per-IP rate limit: max 30 transcriptions per minute
const rateCounts = new Map<string, { count: number; resetAt: number }>();
const MAX_PER_MINUTE = 30;
const MAX_ENTRIES = 5_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (rateCounts.size > MAX_ENTRIES) {
    for (const [key, val] of rateCounts) {
      if (now >= val.resetAt) rateCounts.delete(key);
    }
    if (rateCounts.size > MAX_ENTRIES) return true;
  }
  const entry = rateCounts.get(ip);
  if (!entry || now >= entry.resetAt) {
    rateCounts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count++;
  return entry.count > MAX_PER_MINUTE;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Max 30 transcriptions per minute." },
        { status: 429 },
      );
    }

    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "ElevenLabs API key not configured. Add it in Settings > Credentials.",
        },
        { status: 500 },
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof File)) {
      return NextResponse.json(
        { error: 'Missing "audio" file in form data.' },
        { status: 400 },
      );
    }

    if (audioFile.size > MAX_AUDIO_BYTES) {
      return NextResponse.json(
        { error: `Audio file too large. Max ${MAX_AUDIO_BYTES / 1024 / 1024}MB.` },
        { status: 400 },
      );
    }

    if (audioFile.size === 0) {
      return NextResponse.json(
        { error: "Audio file is empty." },
        { status: 400 },
      );
    }

    // Forward to ElevenLabs STT REST API
    const sttForm = new FormData();
    sttForm.append("file", audioFile, audioFile.name || "recording.webm");
    sttForm.append("model_id", STT_MODEL_ID);

    console.log(
      `[voice/transcribe] Sending ${audioFile.size} bytes to ElevenLabs STT (${STT_MODEL_ID})`,
    );
    const startMs = Date.now();

    const sttResponse = await fetch(STT_ENDPOINT, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
      },
      body: sttForm,
    });

    const elapsedMs = Date.now() - startMs;

    if (!sttResponse.ok) {
      const errText = await sttResponse.text().catch(() => "Unknown error");
      console.error(
        `[voice/transcribe] ElevenLabs returned ${sttResponse.status} (${elapsedMs}ms): ${errText}`,
      );
      return NextResponse.json(
        { error: `Transcription failed: ${sttResponse.status}` },
        { status: sttResponse.status },
      );
    }

    const data = (await sttResponse.json()) as {
      text?: string;
      language_code?: string;
      language_probability?: number;
    };

    const transcript = (data.text ?? "").trim();
    console.log(
      `[voice/transcribe] OK (${elapsedMs}ms): "${transcript.substring(0, 80)}${transcript.length > 80 ? "..." : ""}"`,
    );

    return NextResponse.json({
      transcript,
      language: data.language_code,
    });
  } catch (err) {
    if (err instanceof NextResponse) return err;
    console.error("[voice/transcribe] Error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
