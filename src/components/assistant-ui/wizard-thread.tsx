"use client";

import { memo, useMemo, type FC } from "react";
import { ThreadPrimitive } from "@assistant-ui/react";
import type { TaskType, WizardTaskConfig } from "@/features/tasks/types";
import { WIZARD_STARTERS } from "@/features/tasks/lib/wizardStarters";
import { WizardWelcome } from "@/components/assistant-ui/WizardWelcome";
import { WizardUserMessage } from "@/components/assistant-ui/WizardUserMessage";
import { WizardAssistantMessage } from "@/components/assistant-ui/WizardAssistantMessage";
import { WizardComposer, ThreadScrollToBottom } from "@/components/assistant-ui/WizardComposer";

// Re-export sub-components for external consumers
export { WizardWelcome } from "@/components/assistant-ui/WizardWelcome";
export { WizardUserMessage } from "@/components/assistant-ui/WizardUserMessage";
export { WizardAssistantMessage, WIZARD_PROSE_CLASSES } from "@/components/assistant-ui/WizardAssistantMessage";
export { WizardComposer, ThreadScrollToBottom } from "@/components/assistant-ui/WizardComposer";

// ─── Props ───────────────────────────────────────────────────────────────────

interface WizardThreadProps {
  taskType: TaskType;
  onTaskConfig: (config: WizardTaskConfig | null) => void;
  onConfirm: () => void;
  confirmBusy: boolean;
}

// ─── Thread ──────────────────────────────────────────────────────────────────

export const WizardThread: FC<WizardThreadProps> = memo(
  function WizardThread({
    taskType,
    onTaskConfig,
    onConfirm,
    confirmBusy,
  }) {
    const starters = useMemo(() => WIZARD_STARTERS[taskType], [taskType]);

    return (
      <ThreadPrimitive.Root className="aui-root aui-thread-root flex h-full flex-col">
        <ThreadPrimitive.Viewport className="aui-thread-viewport relative flex min-h-0 flex-1 flex-col overflow-y-auto scroll-smooth px-4 pt-4">
          <ThreadPrimitive.Empty>
            <WizardWelcome starters={starters} />
          </ThreadPrimitive.Empty>

          <ThreadPrimitive.Messages
            components={{
              UserMessage: WizardUserMessage,
              AssistantMessage: () => (
                <WizardAssistantMessage
                  taskType={taskType}
                  onTaskConfig={onTaskConfig}
                  onConfirm={onConfirm}
                  confirmBusy={confirmBusy}
                />
              ),
            }}
          />

          {/* Spacer pushes composer to bottom when content is short */}
          <div className="grow" />

          <ThreadPrimitive.ViewportFooter className="sticky bottom-0 flex shrink-0 flex-col items-center justify-end bg-gradient-to-t from-card from-40% pb-3 pt-4">
            <ThreadScrollToBottom />
            <WizardComposer />
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    );
  },
);
