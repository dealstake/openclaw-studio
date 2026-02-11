"use client";

import { memo, type ReactNode } from "react";
import {
  useLocalRuntime,
  AssistantRuntimeProvider,
  type ChatModelAdapter,
  type ChatModelRunOptions,
} from "@assistant-ui/react";
import type { TaskType, WizardMessage } from "@/features/tasks/types";

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
        throw new Error(
          data.error ?? `Wizard error (${res.status})`,
        );
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
  const adapter = createWizardAdapter(taskType, agents);
  const runtime = useLocalRuntime(adapter);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
});
