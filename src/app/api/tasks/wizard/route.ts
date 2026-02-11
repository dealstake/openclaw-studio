import { NextResponse, type NextRequest } from "next/server";
import type { WizardMessage, TaskType } from "@/features/tasks/types";

export const runtime = "nodejs";

// ─── System prompt ───────────────────────────────────────────────────────────

function buildSystemPrompt(taskType: TaskType, agents: string[]): string {
  const agentList =
    agents.length > 0
      ? agents.map((a) => `• ${a}`).join("\n")
      : "• (no agents configured yet)";

  const scheduleGuide: Record<TaskType, string> = {
    constant: `The user selected a CONSTANT task (runs 24/7 until toggled off).
Available intervals: 1 min, 2 min, 5 min.
Default interval: 5 min (300000ms).
Default model: anthropic/claude-haiku-3.5 (cheap for frequent runs).`,
    periodic: `The user selected a PERIODIC task (runs at regular intervals).
Available intervals: 15 min, 30 min, 1 hour, 2 hours, 4 hours, 8 hours, 12 hours, 24 hours.
Default interval: 1 hour (3600000ms).
Default model: anthropic/claude-sonnet-4-6 (balanced for moderate frequency).`,
    scheduled: `The user selected a SCHEDULED task (runs at specific times on specific days).
Days: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat.
Times in HH:mm 24h format. Default timezone: America/New_York.
Default model: anthropic/claude-opus-4-6 (quality for infrequent runs).`,
  };

  return `You are a Task Creation Wizard for an AI agent management platform.
Your job is to help users create automated agent tasks through a brief, friendly conversation.

## Available Agents
${agentList}

## Task Type
${scheduleGuide[taskType]}

## Your Process
1. The user will describe what they want done. Ask 1-3 SHORT follow-up questions to clarify specifics (what to look for, where to report, any thresholds/criteria). Don't interrogate — be conversational.
2. When you have enough info, generate the task configuration as a JSON block.
3. Never mention cron expressions, intervals in milliseconds, or technical implementation details.
4. Explain the schedule in human terms ("every 5 minutes", "weekdays at 9am").
5. If the user's request doesn't fit the selected task type, gently suggest the right type.

## Output Format
When you're ready to propose a task, output EXACTLY this format (the JSON block must be parseable):

Here's what I'll set up for you:

**[task name]** — [one-line description]
📅 [human-readable schedule]
🤖 Agent: [agent name]

\`\`\`json:task-config
{
  "name": "Task Name",
  "description": "One-line description of what this task does",
  "type": "${taskType}",
  "schedule": ${taskType === "constant" ? '{ "type": "constant", "intervalMs": 300000 }' : taskType === "periodic" ? '{ "type": "periodic", "intervalMs": 3600000 }' : '{ "type": "scheduled", "days": [1,2,3,4,5], "times": ["09:00"], "timezone": "America/New_York" }'},
  "prompt": "The full agent prompt with clear instructions. Include state management instructions for constant/periodic tasks.",
  "model": "${taskType === "constant" ? "anthropic/claude-haiku-3.5" : taskType === "periodic" ? "anthropic/claude-sonnet-4-6" : "anthropic/claude-opus-4-6"}",
  "agentId": "${agents[0] ?? "alex"}"
}
\`\`\`

Does this look right? I can adjust anything before we create it.

## Rules
- Be conversational and friendly, NOT technical
- Keep responses concise (2-4 sentences per reply, except the final config)
- Ask at most 3 follow-up questions total (often 1-2 is enough)
- For constant/periodic tasks, always include state management in the prompt:
  "Read state from tasks/{taskId}/state.json, compare against current data, update state. Only report NEW findings."
  Use {taskId} as a placeholder — it will be replaced when the task is created.
- Pick the most appropriate agent from the list. If only one agent exists, use that one.
- The prompt you generate should be a clear, actionable instruction the agent can follow independently.
- When generating the prompt for the task config, prefix it with [TASK:{taskId}]`;
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

// ─── POST /api/tasks/wizard ──────────────────────────────────────────────────

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
        { status: 400 }
      );
    }

    if (!taskType || !["constant", "periodic", "scheduled"].includes(taskType)) {
      return NextResponse.json(
        { error: "taskType must be constant, periodic, or scheduled." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[wizard] GEMINI_API_KEY not configured");
      return NextResponse.json(
        { error: "Wizard AI is not configured. Missing GEMINI_API_KEY." },
        { status: 500 }
      );
    }

    const systemPrompt = buildSystemPrompt(taskType, agents);
    const contents = toGeminiContents(messages);

    // Use Gemini streaming API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`;

    const geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: {
          maxOutputTokens: 2048,
          temperature: 0.7,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("[wizard] Gemini API error:", geminiRes.status, errText);
      return NextResponse.json(
        { error: `Wizard AI error (${geminiRes.status})` },
        { status: 502 }
      );
    }

    if (!geminiRes.body) {
      return NextResponse.json(
        { error: "No response body from Gemini." },
        { status: 502 }
      );
    }

    // Transform Gemini SSE stream into our simpler SSE format
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
                    content?: { parts?: Array<{ text?: string }> };
                  }>;
                };
                const text =
                  parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) {
                  controller.enqueue(
                    encoder.encode(
                      `data: ${JSON.stringify({ text })}\n\n`
                    )
                  );
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
    const message = err instanceof Error ? err.message : "Wizard request failed.";
    console.error("[wizard] POST error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
