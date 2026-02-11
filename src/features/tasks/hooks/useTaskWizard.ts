import { useCallback, useRef, useState } from "react";
import type {
  TaskType,
  WizardMessage,
  WizardTaskConfig,
  CreateTaskPayload,
} from "@/features/tasks/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract JSON task config from wizard response text */
function extractTaskConfig(text: string): WizardTaskConfig | null {
  // Look for ```json:task-config ... ``` blocks
  const match = text.match(/```json:task-config\s*\n([\s\S]*?)```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as WizardTaskConfig;
  } catch {
    return null;
  }
}

export type WizardStep = "type-select" | "chat" | "confirm";

export interface UseTaskWizardReturn {
  // State
  step: WizardStep;
  taskType: TaskType | null;
  messages: WizardMessage[];
  streaming: boolean;
  error: string | null;
  taskConfig: WizardTaskConfig | null;

  // Actions
  selectType: (type: TaskType) => void;
  sendMessage: (text: string) => Promise<void>;
  confirm: () => CreateTaskPayload | null;
  reset: () => void;
  goBack: () => void;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useTaskWizard(agents: string[]): UseTaskWizardReturn {
  const [step, setStep] = useState<WizardStep>("type-select");
  const [taskType, setTaskType] = useState<TaskType | null>(null);
  const [messages, setMessages] = useState<WizardMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskConfig, setTaskConfig] = useState<WizardTaskConfig | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const selectType = useCallback((type: TaskType) => {
    setTaskType(type);
    setStep("chat");
    setMessages([]);
    setTaskConfig(null);
    setError(null);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!taskType || streaming) return;

      const userMsg: WizardMessage = { role: "user", content: text };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setStreaming(true);
      setError(null);

      // Abort any in-flight request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await fetch("/api/tasks/wizard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages,
            taskType,
            agents,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          throw new Error(data.error ?? `Wizard error (${res.status})`);
        }

        if (!res.body) throw new Error("No response body.");

        // Stream SSE response
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let assistantText = "";
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
              assistantText += parsed.text;

              // Update assistant message in-place during streaming
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return [
                    ...prev.slice(0, -1),
                    { role: "assistant" as const, content: assistantText },
                  ];
                }
                return [
                  ...prev,
                  { role: "assistant" as const, content: assistantText },
                ];
              });
            } catch {
              // Skip malformed chunks
            }
          }
        }

        // Check if response contains a task config
        const config = extractTaskConfig(assistantText);
        if (config) {
          setTaskConfig(config);
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        const message =
          err instanceof Error ? err.message : "Wizard request failed.";
        setError(message);
      } finally {
        setStreaming(false);
      }
    },
    [taskType, streaming, messages, agents]
  );

  const confirm = useCallback((): CreateTaskPayload | null => {
    if (!taskConfig) return null;
    // Don't transition step here — caller does it after successful creation
    return {
      agentId: taskConfig.agentId,
      name: taskConfig.name,
      description: taskConfig.description,
      type: taskConfig.type,
      schedule: taskConfig.schedule,
      prompt: taskConfig.prompt,
      model: taskConfig.model,
      deliveryChannel: taskConfig.deliveryChannel ?? null,
    };
  }, [taskConfig]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setStep("type-select");
    setTaskType(null);
    setMessages([]);
    setStreaming(false);
    setError(null);
    setTaskConfig(null);
  }, []);

  const goBack = useCallback(() => {
    if (step === "chat") {
      abortRef.current?.abort();
      setStep("type-select");
      setTaskType(null);
      setMessages([]);
      setStreaming(false);
      setError(null);
      setTaskConfig(null);
    } else if (step === "confirm") {
      setStep("chat");
    }
  }, [step]);

  return {
    step,
    taskType,
    messages,
    streaming,
    error,
    taskConfig,
    selectType,
    sendMessage,
    confirm,
    reset,
    goBack,
  };
}
