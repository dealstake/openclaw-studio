import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Practice Chat — Direct Gemini API for practice sessions
// ---------------------------------------------------------------------------

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

interface RequestBody {
  systemPrompt: string;
  messages: Message[];
}

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Practice chat not configured (missing GEMINI_API_KEY)" },
      { status: 503 },
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { systemPrompt, messages } = body;
  if (!systemPrompt || !Array.isArray(messages)) {
    return NextResponse.json(
      { error: "systemPrompt and messages[] required" },
      { status: 400 },
    );
  }

  // Convert to Gemini format
  const contents = messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const geminiBody = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 1024,
      topP: 0.95,
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    ],
  };

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiBody),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[practice/chat] Gemini error:", res.status, errText);
      return NextResponse.json(
        { error: `AI service error (${res.status})` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No response generated.";

    return NextResponse.json({ text });
  } catch (err) {
    console.error("[practice/chat] error:", err);
    return NextResponse.json(
      { error: "Failed to reach AI service" },
      { status: 502 },
    );
  }
}
