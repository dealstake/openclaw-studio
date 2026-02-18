import { NextResponse, type NextRequest } from "next/server";
import type { WizardMessage, TaskType } from "@/features/tasks/types";
import { buildSystemPrompt, TASK_CONFIG_SCHEMA } from "@/features/tasks/lib/wizard-prompts";
import { handleApiError } from "@/lib/api/helpers";

export const runtime = "nodejs";

// ─── Gemini model configuration ──────────────────────────────────────────────
const GEMINI_MODEL = "gemini-2.5-pro";

// ─── Gemini API helpers ──────────────────────────────────────────────────────

interface GeminiContent {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

function toGeminiContents(messages: WizardMessage[]): GeminiContent[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
}

// ─── POST /api/tasks/wizard ── Streaming conversational endpoint ─────────────

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      messages: WizardMessage[];
      taskType: TaskType;
      agents?: string[];
    };

    const { messages, taskType, agents = ["alex"] } = body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "messages array is required." },
        { status: 400 },
      );
    }

    if (!taskType || !["constant", "periodic", "scheduled"].includes(taskType)) {
      return NextResponse.json(
        { error: "taskType must be constant, periodic, or scheduled." },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[wizard] GEMINI_API_KEY not configured");
      return NextResponse.json(
        { error: "Wizard AI is not configured. Missing GEMINI_API_KEY." },
        { status: 500 },
      );
    }

    const systemPrompt = buildSystemPrompt(taskType, agents);
    const contents = toGeminiContents(messages);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          maxOutputTokens: 65536,
          temperature: 0.7,
          thinkingConfig: { thinkingBudget: 1024 },
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("[wizard] Gemini API error:", geminiRes.status, errText);
      return NextResponse.json(
        { error: `Wizard AI error (${geminiRes.status})` },
        { status: 502 },
      );
    }

    if (!geminiRes.body) {
      return NextResponse.json(
        { error: "No response body from Gemini." },
        { status: 502 },
      );
    }

    // Transform Gemini SSE stream into our simpler SSE format.
    // Gemini 2.5 Pro with thinking returns parts with "thought" flag — we skip those.
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          const reader = geminiRes.body!.getReader();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            const events = buffer.split(/\r?\n\r?\n/);
            buffer = events.pop() ?? "";

            for (const event of events) {
              const dataLine = event
                .split(/\r?\n/)
                .filter((l) => l.startsWith("data: "))
                .map((l) => l.slice(6))
                .join("");

              if (!dataLine || dataLine.trim() === "[DONE]") continue;

              try {
                const parsed = JSON.parse(dataLine.trim()) as {
                  candidates?: Array<{
                    content?: {
                      parts?: Array<{ text?: string; thought?: boolean }>;
                    };
                  }>;
                };
                const parts = parsed.candidates?.[0]?.content?.parts;
                if (!parts) continue;
                for (const part of parts) {
                  if (part.thought) continue;
                  if (part.text) {
                    controller.enqueue(
                      encoder.encode(
                        `data: ${JSON.stringify({ text: part.text })}\n\n`,
                      ),
                    );
                  }
                }
              } catch {
                // Skip malformed chunks
              }
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          console.error("[wizard] streaming error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    return handleApiError(err, "wizard POST", "Wizard request failed.");
  }
}

// ─── PUT /api/tasks/wizard ── Structured output extraction ───────────────────

export async function PUT(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      rawConfig: Record<string, unknown>;
      taskType: TaskType;
    };

    const { rawConfig, taskType } = body;
    if (!rawConfig || typeof rawConfig !== "object") {
      return NextResponse.json(
        { error: "rawConfig object is required." },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured." },
        { status: 500 },
      );
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: `You are a JSON validator. Given a task configuration object, clean it up and return a valid configuration matching the required schema exactly. The task type is "${taskType}". Do not change the meaning — only fix formatting, missing fields, or invalid values. If a field is missing, use sensible defaults.`,
            },
          ],
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Validate and return this task config:\n${JSON.stringify(rawConfig, null, 2)}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: TASK_CONFIG_SCHEMA,
          temperature: 0,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("[wizard/validate] Gemini error:", geminiRes.status, errText);
      return NextResponse.json({ config: rawConfig });
    }

    const result = (await geminiRes.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return NextResponse.json({ config: rawConfig });
    }

    try {
      const validated = JSON.parse(text);
      return NextResponse.json({ config: validated });
    } catch {
      return NextResponse.json({ config: rawConfig });
    }
  } catch (err) {
    return handleApiError(err, "wizard/validate PUT", "Validation failed.");
  }
}
