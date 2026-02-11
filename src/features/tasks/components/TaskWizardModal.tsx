"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import {
  X,
  ArrowLeft,
  Zap,
  Clock,
  Calendar,
  Send,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { TaskType, CreateTaskPayload, WizardTaskConfig } from "@/features/tasks/types";
import { useTaskWizard } from "@/features/tasks/hooks/useTaskWizard";
import { TaskPreviewCard } from "./TaskPreviewCard";

// ─── Suggested starters ─────────────────────────────────────────────────────

const STARTERS: Record<TaskType, string[]> = {
  constant: [
    "Monitor my inbox for urgent emails",
    "Watch for new MCA applications",
    "Track deal status changes",
  ],
  periodic: [
    "Summarize new emails every hour",
    "Check for pending approvals",
    "Update deal pipeline spreadsheet",
  ],
  scheduled: [
    "Send me a daily pipeline summary at 9am",
    "Generate a weekly recap every Sunday",
    "Prepare a funding report on Mondays",
  ],
};

// ─── Type selector cards ─────────────────────────────────────────────────────

const TYPE_CARDS: Array<{
  type: TaskType;
  icon: typeof Zap;
  title: string;
  desc: string;
  color: string;
}> = [
  {
    type: "constant",
    icon: Zap,
    title: "Constant (24/7)",
    desc: "Always watching. Runs continuously until you turn it off.",
    color: "border-amber-500/40 hover:border-amber-500/70 hover:bg-amber-500/5",
  },
  {
    type: "periodic",
    icon: Clock,
    title: "Periodic",
    desc: "Runs at regular intervals. Every 15 min, every hour, etc.",
    color: "border-blue-500/40 hover:border-blue-500/70 hover:bg-blue-500/5",
  },
  {
    type: "scheduled",
    icon: Calendar,
    title: "Scheduled",
    desc: "Runs at specific times. Every weekday at 9am, etc.",
    color: "border-violet-500/40 hover:border-violet-500/70 hover:bg-violet-500/5",
  },
];

// ─── Extract task config from message text ───────────────────────────────────

function extractTaskConfig(text: string): WizardTaskConfig | null {
  const match = text.match(/```json:task-config\s*\n([\s\S]*?)```/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]) as WizardTaskConfig;
  } catch {
    return null;
  }
}

/** Strip the JSON config block from display text */
function stripConfigBlock(text: string): string {
  return text.replace(/```json:task-config\s*\n[\s\S]*?```/g, "").trim();
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface TaskWizardModalProps {
  open: boolean;
  agents: string[];
  creating: boolean;
  onClose: () => void;
  onCreateTask: (payload: CreateTaskPayload) => Promise<void>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TaskWizardModal = memo(function TaskWizardModal({
  open,
  agents,
  creating,
  onClose,
  onCreateTask,
}: TaskWizardModalProps) {
  const wizard = useTaskWizard(agents);
  const [input, setInput] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [wizard.messages]);

  // Focus input when entering chat step
  useEffect(() => {
    if (wizard.step === "chat" && inputRef.current) {
      inputRef.current.focus();
    }
  }, [wizard.step]);

  const handleSend = useCallback(
    async (text?: string) => {
      const msg = (text ?? input).trim();
      if (!msg || wizard.streaming) return;
      setInput("");
      await wizard.sendMessage(msg);
    },
    [input, wizard]
  );

  const handleSubmit = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      void handleSend();
    },
    [handleSend]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend]
  );

  const handleConfirm = useCallback(async () => {
    const payload = wizard.confirm();
    if (!payload) return;
    setConfirmBusy(true);
    try {
      await onCreateTask(payload);
      // Only close on success — errors are shown in TasksPanel
      wizard.reset();
      onClose();
    } catch {
      // Error is surfaced by useAgentTasks — keep wizard open for retry
      setConfirmBusy(false);
    }
  }, [wizard, onCreateTask, onClose]);

  const handleAdjust = useCallback(() => {
    void wizard.sendMessage("Let me adjust that. Can you change...");
  }, [wizard]);

  const handleClose = useCallback(() => {
    wizard.reset();
    onClose();
  }, [wizard, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Task Creation Wizard"
    >
      <div className="flex h-[min(85vh,680px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
          <div className="flex items-center gap-2">
            {wizard.step !== "type-select" ? (
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/65"
                onClick={wizard.goBack}
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {wizard.step === "type-select"
                  ? "New Task"
                  : wizard.step === "chat"
                    ? "Task Wizard"
                    : "Task Created"}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/65"
            onClick={handleClose}
            aria-label="Close wizard"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {wizard.step === "type-select" && (
            <TypeSelectStep onSelect={wizard.selectType} />
          )}
          {wizard.step === "chat" && (
            <ChatStep
              messages={wizard.messages}
              streaming={wizard.streaming}
              error={wizard.error}
              taskType={wizard.taskType}
              confirmBusy={confirmBusy || creating}
              onConfirm={handleConfirm}
              onAdjust={handleAdjust}
              onStarterClick={(text) => void handleSend(text)}
              chatEndRef={chatEndRef}
            />
          )}
          {wizard.step === "confirm" && <ConfirmStep />}
        </div>

        {/* Chat input (only in chat step) */}
        {wizard.step === "chat" ? (
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 border-t border-border/40 px-4 py-3"
          >
            <textarea
              ref={inputRef}
              className="min-h-[36px] max-h-[120px] flex-1 resize-none rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
              placeholder="Describe what you want this task to do…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={wizard.streaming}
            />
            <button
              type="submit"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-primary/40 bg-primary/10 text-primary transition hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!input.trim() || wizard.streaming}
              aria-label="Send message"
            >
              {wizard.streaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
});

// ─── Step: Type Select ───────────────────────────────────────────────────────

const TypeSelectStep = memo(function TypeSelectStep({
  onSelect,
}: {
  onSelect: (type: TaskType) => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">
          What kind of task?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how often this task should run.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {TYPE_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.type}
              type="button"
              className={`flex items-start gap-3 rounded-xl border bg-card/70 p-4 text-left transition ${card.color}`}
              onClick={() => onSelect(card.type)}
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                <Icon className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {card.title}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {card.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});

// ─── Step: Chat ──────────────────────────────────────────────────────────────

const ChatStep = memo(function ChatStep({
  messages,
  streaming,
  error,
  taskType,
  confirmBusy,
  onConfirm,
  onAdjust,
  onStarterClick,
  chatEndRef,
}: {
  messages: Array<{ role: string; content: string }>;
  streaming: boolean;
  error: string | null;
  taskType: TaskType | null;
  confirmBusy: boolean;
  onConfirm: () => void;
  onAdjust: () => void;
  onStarterClick: (text: string) => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  const starters = taskType ? STARTERS[taskType] : [];
  const showStarters = messages.length === 0 && !streaming;

  return (
    <div className="flex flex-col gap-3 p-4">
      {/* Welcome + starters */}
      {showStarters ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/30 px-3 py-2.5 text-sm text-foreground">
            <p>
              What do you want this task to do? Describe it in your own words — I&apos;ll
              help you set it up.
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Suggestions
            </span>
            {starters.map((s) => (
              <button
                key={s}
                type="button"
                className="rounded-md border border-border/60 bg-card/50 px-3 py-2 text-left text-xs text-muted-foreground transition hover:border-border hover:bg-muted/40 hover:text-foreground"
                onClick={() => onStarterClick(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Messages */}
      {messages.map((msg, i) => {
        const isUser = msg.role === "user";
        const config = !isUser ? extractTaskConfig(msg.content) : null;
        const displayText = !isUser ? stripConfigBlock(msg.content) : msg.content;

        return (
          <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                isUser
                  ? "bg-primary/15 text-foreground"
                  : "bg-muted/30 text-foreground"
              }`}
            >
              {isUser ? (
                <p>{displayText}</p>
              ) : (
                <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {displayText}
                  </ReactMarkdown>
                </div>
              )}
              {config ? (
                <TaskPreviewCard
                  config={config}
                  onConfirm={onConfirm}
                  onAdjust={onAdjust}
                  busy={confirmBusy}
                />
              ) : null}
            </div>
          </div>
        );
      })}

      {/* Streaming indicator */}
      {streaming && messages[messages.length - 1]?.role !== "assistant" ? (
        <div className="flex justify-start">
          <div className="flex items-center gap-1.5 rounded-lg bg-muted/30 px-3 py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Thinking…</span>
          </div>
        </div>
      ) : null}

      {/* Error */}
      {error ? (
        <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground">
          {error}
        </div>
      ) : null}

      <div ref={chatEndRef} />
    </div>
  );
});

// ─── Step: Confirm ───────────────────────────────────────────────────────────

const ConfirmStep = memo(function ConfirmStep() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8 py-16">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10">
        <CheckCircle2 className="h-6 w-6 text-emerald-400" />
      </div>
      <div className="text-center">
        <h3 className="text-base font-semibold text-foreground">
          Task Created!
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your task is now active. You can manage it from the Tasks panel.
        </p>
      </div>
    </div>
  );
});
