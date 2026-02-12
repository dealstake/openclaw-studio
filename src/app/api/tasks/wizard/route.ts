import { NextResponse, type NextRequest } from "next/server";
import type { WizardMessage, TaskType } from "@/features/tasks/types";

export const runtime = "nodejs";

// ─── Gemini model configuration ──────────────────────────────────────────────
// Use 2.5 Pro with thinking for higher-quality task planning.
const GEMINI_MODEL = "gemini-2.5-pro";

// ─── Task config JSON Schema for structured extraction ───────────────────────
// When streaming completes with a config block, we run a second call with
// responseSchema to guarantee valid JSON conforming to our type system.

const TASK_CONFIG_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string", description: "Short human-readable task name" },
    description: { type: "string", description: "One-line description of what this task does" },
    type: { type: "string", enum: ["constant", "periodic", "scheduled"] },
    schedule: {
      type: "object",
      description: "Schedule configuration. Must include 'type' field matching the task type.",
      properties: {
        type: { type: "string", enum: ["constant", "periodic", "scheduled"] },
        intervalMs: { type: "number", description: "Interval in ms (for constant/periodic)" },
        days: {
          type: "array",
          items: { type: "number" },
          description: "Days of week 0=Sun..6=Sat (for scheduled)",
        },
        times: {
          type: "array",
          items: { type: "string" },
          description: "Times in HH:mm 24h format (for scheduled)",
        },
        timezone: { type: "string", description: "IANA timezone (for scheduled)" },
      },
      required: ["type"],
    },
    prompt: { type: "string", description: "Full agent prompt with clear instructions" },
    model: { type: "string", description: "Model identifier (e.g. anthropic/claude-haiku-3.5)" },
    agentId: { type: "string", description: "Which agent runs this task" },
  },
  required: ["name", "description", "type", "schedule", "prompt", "model", "agentId"],
};

// ─── System prompt ───────────────────────────────────────────────────────────

function buildSystemPrompt(taskType: TaskType, agents: string[]): string {
  const agentList =
    agents.length > 0
      ? agents.map((a) => `• ${a}`).join("\n")
      : "• (no agents configured yet)";

  const scheduleGuide: Record<TaskType, string> = {
    constant: `The user selected a CONSTANT task (runs 24/7 until toggled off).
This means an AI agent will be poked at a fixed interval (1, 2, or 5 minutes) to check on something.
Each run is independent — the agent reads its last state from a file, checks for changes, and only reports NEW findings.
Available intervals: 1 min (60000ms), 2 min (120000ms), 5 min (300000ms).
Default interval: 5 min (300000ms).
Default model: anthropic/claude-haiku-3.5 (cheap for frequent runs).`,
    periodic: `The user selected a PERIODIC task (runs at regular intervals).
This means an AI agent is triggered every N minutes/hours to perform a check, generate a summary, or process data.
Each run is independent with file-based state persistence for tracking what changed.
Available intervals: 15min (900000ms), 30min (1800000ms), 1hr (3600000ms), 2hr (7200000ms), 4hr (14400000ms), 8hr (28800000ms), 12hr (43200000ms), 24hr (86400000ms).
Default interval: 1 hour (3600000ms).
Default model: anthropic/claude-sonnet-4-6 (balanced for moderate frequency).`,
    scheduled: `The user selected a SCHEDULED task (runs at specific times on specific days).
This means an AI agent runs at precise times — like "weekdays at 9am" or "Monday and Thursday at 2pm".
Typically used for reports, summaries, or periodic deliverables.
Days: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat.
Times in HH:mm 24-hour format. Default timezone: America/New_York.
Default model: anthropic/claude-opus-4-6 (quality for infrequent, high-value runs).`,
  };

  const scheduleSchemaExample: Record<TaskType, string> = {
    constant: `{ "type": "constant", "intervalMs": 300000 }`,
    periodic: `{ "type": "periodic", "intervalMs": 3600000 }`,
    scheduled: `{ "type": "scheduled", "days": [1,2,3,4,5], "times": ["09:00"], "timezone": "America/New_York" }`,
  };

  return `You are a Task Creation Wizard — an expert AI assistant that helps non-technical users create automated agent tasks through brief, friendly conversation.

You are embedded inside a dashboard application. The user has already selected a task type and is now in a chat interface with you.

## Context

### Available Agents
These are the AI agents available to run tasks:
${agentList}

### Task Type Selected
${scheduleGuide[taskType]}

## Your Conversation Strategy

**Phase 1 — Understand (1-2 messages):**
Ask what the user wants this task to do. Listen carefully. Ask 1-2 SHORT, targeted follow-up questions to clarify:
- What specifically to do (the action)
- What criteria, thresholds, or conditions matter
- Where to report results (default: announce back to the dashboard)
- Any specific accounts, services, or data sources involved

Do NOT interrogate. Be conversational and warm. If the user's first message is clear enough, skip straight to proposing the config.

**Phase 2 — Propose (1 message):**
When you have enough information, present the task configuration. Include:
1. A brief human-readable summary (name, what it does, schedule in plain English, which agent)
2. A JSON configuration block in a fenced code block tagged \`json:task-config\`

The JSON block MUST be valid JSON conforming to this exact structure:
\`\`\`
{
  "name": "string — short task name",
  "description": "string — one-line description",
  "type": "${taskType}",
  "schedule": ${scheduleSchemaExample[taskType]},
  "prompt": "string — the full agent prompt",
  "model": "string — model identifier",
  "agentId": "string — agent name from the list above"
}
\`\`\`

**Phase 3 — Adjust (if needed):**
If the user asks to change something, output an updated config block with the changes applied.

## Prompt Generation Rules

The \`prompt\` field is the most important part — it's the instruction the agent follows on every run. Make it:
- Clear, specific, and actionable
- Prefixed with \`[TASK:{taskId}]\` (literal placeholder — will be replaced)
- For constant/periodic tasks, ALWAYS include state management:
  "Read your previous state from tasks/{taskId}/state.json. Compare current results against last-known state. Write updated state back to tasks/{taskId}/state.json. ONLY report NEW findings since your last check."
- For scheduled tasks, focus on thorough output since they run less often

## Strict Rules
- NEVER mention cron expressions, milliseconds, or internal implementation
- Explain schedules in human terms: "every 5 minutes", "weekdays at 9am"
- Keep conversational replies to 2-4 sentences (except the final config message)
- Ask at MOST 2-3 follow-up questions total across the entire conversation
- Pick the most appropriate agent from the available list. If only one exists, use that one.
- The JSON block MUST be inside a fenced code block with the tag \`json:task-config\`
- Do NOT output partial or malformed JSON. The config must be complete and parseable.
- After presenting the config, ask "Does this look right? I can adjust anything before we create it."`;
}

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

    // Gemini 2.5 Pro with thinking enabled for higher-quality task planning
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          maxOutputTokens: 4096,
          temperature: 0.7,
          thinkingConfig: { thinkingBudget: 2048 },
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
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const payload = line.slice(6).trim();
              if (!payload || payload === "[DONE]") continue;

              try {
                const parsed = JSON.parse(payload) as {
                  candidates?: Array<{
                    content?: {
                      parts?: Array<{ text?: string; thought?: boolean }>;
                    };
                  }>;
                };
                const parts = parsed.candidates?.[0]?.content?.parts;
                if (!parts) continue;
                // Only emit non-thought text parts
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
    const message =
      err instanceof Error ? err.message : "Wizard request failed.";
    console.error("[wizard] POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ─── POST /api/tasks/wizard/validate ── Structured output extraction ─────────
// After the streaming conversation produces a config block, the client extracts
// the JSON and can optionally call this endpoint to re-validate/clean it using
// Gemini's structured output mode (responseMimeType: application/json +
// responseSchema).  This guarantees the config conforms to our schema.

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

    // Use structured output mode to validate and clean the config
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
      // Fall through — return the raw config as-is if validation fails
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
    const message =
      err instanceof Error ? err.message : "Validation failed.";
    console.error("[wizard/validate] error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
