"use client";

import { memo, useCallback, useEffect, useState } from "react";
import {
  X,
  ArrowLeft,
  Zap,
  Clock,
  Calendar,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import type { TaskType, CreateTaskPayload } from "@/features/tasks/types";
import { useTaskWizard } from "@/features/tasks/hooks/useTaskWizard";
import { WizardRuntimeProvider } from "./WizardRuntimeProvider";
import { WizardThread } from "@/components/assistant-ui/wizard-thread";
import { AgentCreationWizard } from "./AgentCreationWizard";
import { TaskTemplatesSheet } from "./TaskTemplatesSheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

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
    color:
      "border-amber-500/40 hover:border-amber-500/70 hover:bg-amber-500/5",
  },
  {
    type: "periodic",
    icon: Clock,
    title: "Periodic",
    desc: "Runs at regular intervals. Every 15 min, every hour, etc.",
    color:
      "border-blue-500/40 hover:border-blue-500/70 hover:bg-blue-500/5",
  },
  {
    type: "scheduled",
    icon: Calendar,
    title: "Scheduled",
    desc: "Runs at specific times. Every weekday at 9am, etc.",
    color:
      "border-violet-500/40 hover:border-violet-500/70 hover:bg-violet-500/5",
  },
];

// ─── Props ───────────────────────────────────────────────────────────────────

interface TaskWizardModalProps {
  open: boolean;
  agents: string[];
  creating: boolean;
  client: GatewayClient;
  onClose: () => void;
  onCreateTask: (payload: CreateTaskPayload) => Promise<void>;
  onAgentCreated?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const TaskWizardModal = memo(function TaskWizardModal({
  open,
  agents,
  creating,
  client,
  onClose,
  onCreateTask,
  onAgentCreated,
}: TaskWizardModalProps) {
  const wizard = useTaskWizard();
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [showAgentCreation, setShowAgentCreation] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [localAgents, setLocalAgents] = useState<string[]>(agents);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        wizard.reset();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, wizard, onClose]);

  // Prevent body scroll when modal is open (mobile)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleConfirm = useCallback(async () => {
    const payload = wizard.confirm();
    if (!payload) return;
    setConfirmBusy(true);
    try {
      await onCreateTask(payload);
      wizard.reset();
      onClose();
    } catch {
      setConfirmBusy(false);
    }
  }, [wizard, onCreateTask, onClose]);

  const handleAdjust = useCallback(() => {
    // No-op: user can type in the composer to adjust
  }, []);

  const handleClose = useCallback(() => {
    wizard.reset();
    setShowAgentCreation(false);
    setShowTemplates(false);
    onClose();
  }, [wizard, onClose]);

  const handleTemplateCreate = useCallback(
    async (payload: CreateTaskPayload) => {
      await onCreateTask(payload);
      wizard.reset();
      setShowTemplates(false);
      onClose();
    },
    [onCreateTask, wizard, onClose],
  );

  const handleShowAgentCreation = useCallback(() => {
    setShowAgentCreation(true);
  }, []);

  const handleAgentCreated = useCallback(
    (agentId: string) => {
      setLocalAgents((prev) => [...prev, agentId]);
      setShowAgentCreation(false);
      onAgentCreated?.();
    },
    [onAgentCreated],
  );

  const handleCancelAgentCreation = useCallback(() => {
    setShowAgentCreation(false);
  }, []);

  // Keep localAgents in sync with prop
  useEffect(() => {
    setLocalAgents(agents);
  }, [agents]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-background/70 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Task Creation Wizard"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Mobile: full-height sheet from bottom; Desktop: centered card */}
      <div className="flex h-full w-full flex-col overflow-hidden bg-card shadow-2xl transition-[height] duration-300 ease-out sm:h-[min(85vh,680px)] sm:max-w-lg sm:rounded-xl sm:border sm:border-border">
        {/* Modal header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-3">
          <div className="flex items-center gap-2">
            {wizard.step !== "type-select" || showTemplates || showAgentCreation ? (
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/65"
                onClick={
                  showTemplates
                    ? () => setShowTemplates(false)
                    : showAgentCreation
                      ? handleCancelAgentCreation
                      : wizard.goBack
                }
                aria-label="Go back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            ) : null}
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                {showTemplates
                  ? "Templates"
                  : showAgentCreation
                    ? "New Agent"
                    : wizard.step === "type-select"
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
        <div className="min-h-0 flex-1 overflow-hidden">
          {wizard.step === "type-select" &&
            !showAgentCreation &&
            !showTemplates && (
              <div className="h-full overflow-y-auto">
                <TypeSelectStep
                  onSelect={wizard.selectType}
                  onShowTemplates={() => setShowTemplates(true)}
                />
              </div>
            )}
          {showTemplates && !showAgentCreation && (
            <TaskTemplatesSheet
              agents={localAgents}
              onUseTemplate={handleTemplateCreate}
            />
          )}
          {wizard.step === "chat" &&
            wizard.taskType &&
            !showAgentCreation && (
              <TooltipProvider>
                <WizardRuntimeProvider
                  taskType={wizard.taskType}
                  agents={localAgents}
                >
                  <WizardThread
                    taskType={wizard.taskType}
                    onTaskConfig={wizard.setTaskConfig}
                    onConfirm={handleConfirm}
                    onAdjust={handleAdjust}
                    confirmBusy={confirmBusy || creating}
                  />
                </WizardRuntimeProvider>
              </TooltipProvider>
            )}
          {wizard.step === "confirm" && !showAgentCreation && (
            <div className="h-full overflow-y-auto">
              <ConfirmStep />
            </div>
          )}
          {showAgentCreation && (
            <div className="h-full overflow-y-auto">
              <AgentCreationWizard
                client={client}
                onCreated={handleAgentCreated}
                onCancel={handleCancelAgentCreation}
              />
            </div>
          )}
        </div>
        {/* Create agent button — shown during chat step */}
        {wizard.step === "chat" && !showAgentCreation && (
          <div className="flex shrink-0 items-center justify-between border-t border-border/30 px-4 py-3 pb-safe">
            <button
              type="button"
              className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground transition hover:text-primary"
              onClick={handleShowAgentCreation}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="font-mono uppercase tracking-wider">
                Need a new agent?
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

// ─── Step: Type Select ───────────────────────────────────────────────────────

const TypeSelectStep = memo(function TypeSelectStep({
  onSelect,
  onShowTemplates,
}: {
  onSelect: (type: TaskType) => void;
  onShowTemplates: () => void;
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
              className={`flex items-start gap-4 rounded-xl border bg-card/70 p-5 text-left transition ${card.color}`}
              onClick={() => onSelect(card.type)}
            >
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                <Icon className="h-5 w-5 text-foreground" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {card.title}
                </div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {card.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Templates shortcut */}
      <div className="border-t border-border/30 pt-4 text-center">
        <button
          type="button"
          className="text-xs text-muted-foreground transition hover:text-foreground"
          onClick={onShowTemplates}
        >
          Or choose from{" "}
          <span className="font-semibold text-primary">pre-built templates</span>{" "}
          →
        </button>
      </div>
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
