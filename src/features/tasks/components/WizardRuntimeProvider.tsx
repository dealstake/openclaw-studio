"use client";

import { memo, useMemo, type ReactNode } from "react";
import {
  useLocalRuntime,
  AssistantRuntimeProvider,
  type ChatModelAdapter,
  type ChatModelRunOptions,
} from "@assistant-ui/react";
import type { TaskType, WizardMessage, WizardTaskConfig } from "@/features/tasks/types";

// ─── Validate config via structured output endpoint ──────────────────────────

export async function validateTaskConfig(
  rawConfig: Record<string, unknown>,
  taskType: TaskType,
): Promise<WizardTaskConfig> {
  try {
    const res = await fetch("/api/tasks/wizard", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawConfig, taskType }),
    });
    if (res.ok) {
      const data = (await res.json()) as { config: WizardTaskConfig };
      return data.config;
    }
  } catch {
    // Fall through — return raw
  }
  return rawConfig as unknown as WizardTaskConfig;
}

// ─── Chat model adapter ─────────────────────────────────────────────────────

function createWizardAdapter(
  taskType: TaskType,
  agents: string[],
): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }: ChatModelRunOptions) {
      const wizardMessages: WizardMessage[] = messages.flatMap((m) => {
        if (m.role === "system") return [];
        return [
          {
            role:
              m.role === "user"
                ? ("user" as const)
                : ("assistant" as const),
            content: m.content
              .filter(
                (part): part is { type: "text"; text: string } =>
                  part.type === "text",
              )
              .map((part) => part.text)
              .join(""),
          },
        ];
      });

      const res = await fetch("/api/tasks/wizard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: wizardMessages, taskType, agents }),
        signal: abortSignal,
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(data.error ?? `Wizard error (${res.status})`);
      }

      if (!res.body) throw new Error("No response body.");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
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
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload) as { text: string };
            yield {
              content: [{ type: "text" as const, text: parsed.text }],
            };
          } catch {
            // Skip malformed chunks
          }
        }
      }
    },
  };
}

// ─── Provider component ─────────────────────────────────────────────────────

interface WizardRuntimeProviderProps {
  taskType: TaskType;
  agents: string[];
  children: ReactNode;
}

export const WizardRuntimeProvider = memo(function WizardRuntimeProvider({
  taskType,
  agents,
  children,
}: WizardRuntimeProviderProps) {
  // Memoize adapter to avoid recreating on every render
  const adapter = useMemo(
    () => createWizardAdapter(taskType, agents),
    [taskType, agents],
  );
  const runtime = useLocalRuntime(adapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
});
