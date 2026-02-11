"use client";

import { memo, useEffect, useMemo, type FC } from "react";
import {
  ActionBarPrimitive,
  ComposerPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useMessage,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  CopyIcon,
  RefreshCwIcon,
  SendIcon,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { TaskPreviewCard } from "@/features/tasks/components/TaskPreviewCard";
import type { TaskType, WizardTaskConfig } from "@/features/tasks/types";

// ─── Config extraction helpers ───────────────────────────────────────────────

function extractTaskConfig(text: string): WizardTaskConfig | null {
  // Try json:task-config first (preferred), then fall back to plain json blocks
  const match =
    text.match(/```json:task-config\s*\n([\s\S]*?)```/) ??
    text.match(/```json\s*\n([\s\S]*?)```/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    // Validate it looks like a task config (has at least name + schedule or prompt)
    if (parsed && typeof parsed === "object" && ("schedule" in parsed || "prompt" in parsed)) {
      return parsed as WizardTaskConfig;
    }
    return null;
  } catch {
    return null;
  }
}

function stripConfigBlock(text: string): string {
  // Remove all fenced code blocks (json:task-config, json, or bare JSON)
  let stripped = text
    .replace(/```json:task-config\s*\n[\s\S]*?```/g, "")
    .replace(/```json\s*\n[\s\S]*?```/g, "")
    .replace(/```\s*\n\{[\s\S]*?\}\s*\n```/g, "");
  // Remove residual JSON fragments — lines that are mostly punctuation/JSON syntax
  // (Gemini sometimes echoes partial config outside fenced blocks)
  stripped = stripped
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      // Drop lines that are just JSON noise: braces, quoted keys, commas
      if (/^["{}\[\],:\s]*$/.test(t)) return false;
      if (/^"?\s*\}/.test(t) && t.length < 10) return false;
      return true;
    })
    .join("\n")
    .trim();
  return stripped;
}

// ─── Starters ────────────────────────────────────────────────────────────────

const STARTERS: Record<
  TaskType,
  Array<{ prompt: string; text: string }>
> = {
  constant: [
    { prompt: "Monitor my inbox for urgent emails", text: "Monitor my inbox" },
    { prompt: "Watch for new MCA applications", text: "Watch for new applications" },
    { prompt: "Track deal status changes", text: "Track deal changes" },
  ],
  periodic: [
    { prompt: "Summarize new emails every hour", text: "Summarize new emails" },
    { prompt: "Check for pending approvals", text: "Check pending approvals" },
    { prompt: "Update deal pipeline spreadsheet", text: "Update pipeline" },
  ],
  scheduled: [
    { prompt: "Send me a daily pipeline summary at 9am", text: "Daily pipeline summary" },
    { prompt: "Generate a weekly recap every Sunday", text: "Weekly recap" },
    { prompt: "Prepare a funding report on Mondays", text: "Monday funding report" },
  ],
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface WizardThreadProps {
  taskType: TaskType;
  onTaskConfig: (config: WizardTaskConfig | null) => void;
  onConfirm: () => void;
  onAdjust: () => void;
  confirmBusy: boolean;
}

// ─── Thread ──────────────────────────────────────────────────────────────────

export const WizardThread: FC<WizardThreadProps> = memo(
  function WizardThread({
    taskType,
    onTaskConfig,
    onConfirm,
    onAdjust,
    confirmBusy,
  }) {
    const starters = useMemo(() => STARTERS[taskType], [taskType]);

    return (
      <ThreadPrimitive.Root className="aui-root aui-thread-root flex h-full flex-col">
        <ThreadPrimitive.Viewport className="aui-thread-viewport relative flex flex-1 flex-col overflow-y-auto scroll-smooth px-4 pt-4">
          <ThreadPrimitive.Empty>
            <WizardWelcome starters={starters} />
          </ThreadPrimitive.Empty>

          <ThreadPrimitive.Messages
            components={{
              UserMessage: WizardUserMessage,
              AssistantMessage: () => (
                <WizardAssistantMessage
                  onTaskConfig={onTaskConfig}
                  onConfirm={onConfirm}
                  onAdjust={onAdjust}
                  confirmBusy={confirmBusy}
                />
              ),
            }}
          />

          <ThreadPrimitive.ViewportFooter className="sticky bottom-0 flex flex-col items-center justify-end bg-gradient-to-t from-card from-40% pb-3 pt-4">
            <ThreadScrollToBottom />
            <WizardComposer />
          </ThreadPrimitive.ViewportFooter>
        </ThreadPrimitive.Viewport>
      </ThreadPrimitive.Root>
    );
  },
);

// ─── Welcome ─────────────────────────────────────────────────────────────────

const WizardWelcome: FC<{
  starters: Array<{ prompt: string; text: string }>;
}> = memo(function WizardWelcome({ starters }) {
  return (
    <div className="flex grow flex-col items-center justify-center">
      <div className="rounded-lg bg-muted/30 px-4 py-3 text-center text-sm text-foreground">
        <p>
          What do you want this task to do? Describe it in your own words — I&apos;ll
          help you set it up.
        </p>
      </div>
      <div className="mt-4 flex w-full flex-col gap-1.5">
        <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Suggestions
        </span>
        {starters.map((s) => (
          <ThreadPrimitive.Suggestion
            key={s.prompt}
            prompt={s.prompt}
            autoSend
            className="rounded-md border border-border/60 bg-card/50 px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-border hover:bg-muted/40 hover:text-foreground"
          >
            {s.text}
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  );
});

// ─── User message ────────────────────────────────────────────────────────────

const WizardUserMessage: FC = memo(function WizardUserMessage() {
  return (
    <MessagePrimitive.Root className="aui-user-message flex justify-end pb-3">
      <div className="max-w-[85%] rounded-lg bg-primary/15 px-3 py-2 text-sm text-foreground">
        <MessagePrimitive.Content />
      </div>
    </MessagePrimitive.Root>
  );
});

// ─── Assistant message ───────────────────────────────────────────────────────

const WizardAssistantMessage: FC<{
  onTaskConfig: (config: WizardTaskConfig | null) => void;
  onConfirm: () => void;
  onAdjust: () => void;
  confirmBusy: boolean;
}> = memo(function WizardAssistantMessage({
  onTaskConfig,
  onConfirm,
  onAdjust,
  confirmBusy,
}) {
  return (
    <MessagePrimitive.Root className="aui-assistant-message pb-3">
      <div className="max-w-[85%] rounded-lg bg-muted/30 px-3 py-2 text-sm text-foreground">
        <MessagePrimitive.Content
          components={{
            Text: () => (
              <WizardTextPart
                onTaskConfig={onTaskConfig}
                onConfirm={onConfirm}
                onAdjust={onAdjust}
                confirmBusy={confirmBusy}
              />
            ),
          }}
        />
      </div>
      <AssistantActionBar />
    </MessagePrimitive.Root>
  );
});

// ─── Custom text part with config extraction ─────────────────────────────────

const WizardTextPart: FC<{
  onTaskConfig: (config: WizardTaskConfig | null) => void;
  onConfirm: () => void;
  onAdjust: () => void;
  confirmBusy: boolean;
}> = memo(function WizardTextPart({
  onTaskConfig,
  onConfirm,
  onAdjust,
  confirmBusy,
}) {
  const message = useMessage();
  const fullText = message.content
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");

  const config = useMemo(() => extractTaskConfig(fullText), [fullText]);
  const hasConfig = config !== null;
  const isComplete = message.status?.type !== "running";

  useEffect(() => {
    if (isComplete && hasConfig) {
      onTaskConfig(config);
    }
  }, [isComplete, hasConfig, config, onTaskConfig]);

  // If there's a config block, we need to show stripped text + card
  // Otherwise just render normal markdown
  if (hasConfig) {
    const stripped = stripConfigBlock(fullText);
    return (
      <>
        {stripped ? (
          <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {stripped}
            </ReactMarkdown>
          </div>
        ) : null}
        {isComplete ? (
          <TaskPreviewCard
            config={config}
            onConfirm={onConfirm}
            onAdjust={onAdjust}
            busy={confirmBusy}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0">
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

// ─── Composer ────────────────────────────────────────────────────────────────

const WizardComposer: FC = memo(function WizardComposer() {
  return (
    <ComposerPrimitive.Root className="aui-composer-root flex w-full items-end gap-2">
      <ComposerPrimitive.Input
        autoFocus
        placeholder="Describe what you want this task to do…"
        className="aui-composer-input min-h-[36px] max-h-[120px] flex-1 resize-none rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
        submitOnEnter
      />
      <ComposerPrimitive.Send asChild>
        <TooltipIconButton
          tooltip="Send"
          variant="default"
          className="aui-composer-send h-9 w-9 shrink-0 rounded-md transition"
        >
          <SendIcon />
        </TooltipIconButton>
      </ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
  );
});

// ─── Scroll to bottom ────────────────────────────────────────────────────────

const ThreadScrollToBottom: FC = memo(function ThreadScrollToBottom() {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        className="aui-thread-scroll-to-bottom mb-2 rounded-full border border-border bg-card shadow-sm"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
});
