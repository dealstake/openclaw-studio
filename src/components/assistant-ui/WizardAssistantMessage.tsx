"use client";

import { memo, useCallback, useEffect, useMemo, useRef, type FC } from "react";
import { cn } from "@/lib/utils";
import {
  ActionBarPrimitive,
  MessagePrimitive,
  useMessage,
  useMessageRuntime,
} from "@assistant-ui/react";
import { AlertTriangle, CopyIcon, RefreshCwIcon } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { TaskPreviewCard } from "@/features/tasks/components/TaskPreviewCard";
import { validateTaskConfig } from "@/features/tasks/components/WizardRuntimeProvider";
import type { TaskType, WizardTaskConfig } from "@/features/tasks/types";
import {
  extractTaskConfig,
  stripConfigBlock,
} from "@/features/tasks/lib/wizardConfigUtils";

/** Shared prose classes for wizard markdown content */
export const WIZARD_PROSE_CLASSES =
  "prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0";

// ─── Assistant message ───────────────────────────────────────────────────────

export const WizardAssistantMessage: FC<{
  taskType: TaskType;
  onTaskConfig: (config: WizardTaskConfig | null) => void;
  onConfirm: () => void;
  confirmBusy: boolean;
}> = memo(function WizardAssistantMessage({
  taskType,
  onTaskConfig,
  onConfirm,
  confirmBusy,
}) {
  const message = useMessage();
  const messageRuntime = useMessageRuntime();
  const isError =
    message.status?.type === "incomplete" &&
    "reason" in message.status &&
    (message.status as { reason?: string }).reason === "error";
  const errorMessage =
    isError && message.status && "error" in message.status
      ? String((message.status as { error?: unknown }).error ?? "")
      : null;
  const hasContent = message.content.some(
    (p) => p.type === "text" && (p as { text: string }).text.length > 0,
  );

  return (
    <MessagePrimitive.Root className="aui-assistant-message pb-3">
      {isError && !hasContent ? (
        <div className="flex max-w-[85%] items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Something went wrong</p>
            <p className="mt-0.5 text-xs text-destructive/80">
              {errorMessage || "The AI wizard couldn\u2019t respond. Please try again."}
            </p>
            <button
              type="button"
              className="mt-2 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive transition hover:bg-destructive/20"
              onClick={() => {
                messageRuntime.reload();
              }}
            >
              Retry
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-[85%] rounded-lg bg-muted/30 px-3 py-2 text-sm text-foreground">
          <MessagePrimitive.Content
            components={{
              Text: () => (
                <WizardTextPart
                  taskType={taskType}
                  onTaskConfig={onTaskConfig}
                  onConfirm={onConfirm}
                  confirmBusy={confirmBusy}
                />
              ),
            }}
          />
          {isError && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" />
              <span>Response incomplete — {errorMessage || "an error occurred"}</span>
              <button
                type="button"
                className="ml-1 underline hover:no-underline"
                onClick={() => {
                  messageRuntime.reload();
                }}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
      <AssistantActionBar />
    </MessagePrimitive.Root>
  );
});

// ─── Custom text part with config extraction + validation ────────────────────

const WizardTextPart: FC<{
  taskType: TaskType;
  onTaskConfig: (config: WizardTaskConfig | null) => void;
  onConfirm: () => void;
  confirmBusy: boolean;
}> = memo(function WizardTextPart({
  taskType,
  onTaskConfig,
  onConfirm,
  confirmBusy,
}) {
  const message = useMessage();
  const fullText = message.content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");

  const configResult = useMemo(() => extractTaskConfig(fullText), [fullText]);
  const config = configResult?.config ?? null;
  const hasConfig = config !== null;
  const isComplete = message.status?.type !== "running";

  // Track whether we already validated to avoid double-calls
  const validatedRef = useRef(false);

  // Reset validation when message content changes (new config from AI)
  useEffect(() => {
    validatedRef.current = false;
  }, [fullText]);

  const handleValidateAndSet = useCallback(
    async (rawConfig: WizardTaskConfig) => {
      if (validatedRef.current) return;
      validatedRef.current = true;
      try {
        const validated = await validateTaskConfig(
          rawConfig as unknown as Record<string, unknown>,
          taskType,
        );
        onTaskConfig(validated);
      } catch {
        // Fallback to raw config if validation fails
        onTaskConfig(rawConfig);
      }
    },
    [taskType, onTaskConfig],
  );

  useEffect(() => {
    if (isComplete && hasConfig && configResult) {
      void handleValidateAndSet(configResult.config);
    }
  }, [isComplete, hasConfig, configResult, handleValidateAndSet]);

  if (hasConfig && configResult) {
    const stripped = stripConfigBlock(fullText);

    return (
      <>
        {stripped ? (
          <div className={WIZARD_PROSE_CLASSES}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {stripped}
            </ReactMarkdown>
          </div>
        ) : null}
        {isComplete ? (
          <TaskPreviewCard
            config={config}
            onConfirm={onConfirm}
            busy={confirmBusy}
          />
        ) : null}
      </>
    );
  }

  return (
    <div
      className={cn(
        WIZARD_PROSE_CLASSES,
        !isComplete && "after:content-['|'] after:animate-pulse",
      )}
    >
      <MarkdownText />
    </div>
  );
});

// ─── Action bar ──────────────────────────────────────────────────────────────

const AssistantActionBar: FC = memo(function AssistantActionBar() {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-action-bar-root mt-1 flex gap-1"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <CopyIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
});
