"use client";

import { memo, useCallback, useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  X,
  ArrowLeft,
  Sparkles,
  FolderGit2,
  FlaskConical,
  Server,
  Loader2,
} from "lucide-react";
import { appendRow } from "../lib/indexTable";

// ─── Types ───────────────────────────────────────────────────────────────────

type ProjectType = "feature" | "infrastructure" | "research" | "other";
type WizardStep = "type-select" | "details";

interface ProjectForm {
  type: ProjectType;
  name: string;
  description: string;
  priority: "🔴 P0" | "🟡 P1" | "🟢 P2";
}

interface ProjectWizardModalProps {
  open: boolean;
  agentId: string;
  onClose: () => void;
  onCreated: () => void;
}

// ─── Type cards ──────────────────────────────────────────────────────────────

const TYPE_CARDS: Array<{
  type: ProjectType;
  icon: typeof Sparkles;
  title: string;
  desc: string;
  color: string;
}> = [
  {
    type: "feature",
    icon: Sparkles,
    title: "New Feature",
    desc: "Build a new user-facing capability or component.",
    color: "border-green-500/40 hover:border-green-500/70 hover:bg-green-500/5",
  },
  {
    type: "infrastructure",
    icon: Server,
    title: "Infrastructure",
    desc: "Update cloud resources, CI/CD, or deployment logic.",
    color: "border-purple-500/40 hover:border-purple-500/70 hover:bg-purple-500/5",
  },
  {
    type: "research",
    icon: FlaskConical,
    title: "Research Spike",
    desc: "Explore a new technology, API, or design pattern.",
    color: "border-orange-500/40 hover:border-orange-500/70 hover:bg-orange-500/5",
  },
  {
    type: "other",
    icon: FolderGit2,
    title: "Other",
    desc: "Something else — define the scope yourself.",
    color: "border-zinc-500/40 hover:border-zinc-500/70 hover:bg-zinc-500/5",
  },
];

const PRIORITY_OPTIONS = [
  { value: "🔴 P0", label: "P0 — Do now", dot: "bg-red-400" },
  { value: "🟡 P1", label: "P1 — Do next", dot: "bg-yellow-400" },
  { value: "🟢 P2", label: "P2 — When time allows", dot: "bg-green-400" },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function generateMarkdown(form: ProjectForm): string {
  const now = new Date().toISOString().slice(0, 10);
  return `# ${form.name}

> ${form.description}

## Problem

_Describe the problem this project solves._

## Research Findings

_To be filled during research phase._

## Implementation Plan

### Phase 1: TBD
- [ ] Step 1
- [ ] Step 2

## Key Decisions

_Document technical choices and rationale here._

## Continuation Context
_Updated by the agent at end of each work session_
- **Last worked on**: ${now} — Project created
- **Immediate next step**: Define implementation plan and begin Phase 1
- **Blocked by**: Nothing
- **Context needed**: TBD

## History
- ${now}: Project created via Studio wizard.
`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export const ProjectWizardModal = memo(function ProjectWizardModal({
  open,
  agentId,
  onClose,
  onCreated,
}: ProjectWizardModalProps) {
  const [step, setStep] = useState<WizardStep>("type-select");
  const [form, setForm] = useState<ProjectForm>({
    type: "feature",
    name: "",
    description: "",
    priority: "🟡 P1",
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("type-select");
      setForm({ type: "feature", name: "", description: "", priority: "🟡 P1" });
      setError(null);
      setCreating(false);
    }
  }, [open]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleSelectType = useCallback((type: ProjectType) => {
    setForm((prev) => ({ ...prev, type }));
    setStep("details");
  }, []);

  const handleCreate = useCallback(async () => {
    if (!form.name.trim() || !form.description.trim()) {
      setError("Name and description are required.");
      return;
    }

    setCreating(true);
    setError(null);

    const slug = slugify(form.name);
    const doc = `${slug}.md`;
    const markdown = generateMarkdown(form);

    try {
      // 1. Write the project file
      const writeRes = await fetch("/api/workspace/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          path: `projects/${doc}`,
          content: markdown,
        }),
      });
      if (!writeRes.ok) {
        const data = await writeRes.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Write failed: ${writeRes.status}`);
      }

      // 2. Read INDEX.md
      const indexRes = await fetch(
        `/api/workspace/file?agentId=${encodeURIComponent(agentId)}&path=projects/INDEX.md`
      );
      if (!indexRes.ok) {
        throw new Error("Could not read projects/INDEX.md");
      }
      const indexData = (await indexRes.json()) as { content?: string };
      if (!indexData.content) {
        throw new Error("projects/INDEX.md is empty");
      }

      // 3. Append row and write back
      const updatedIndex = appendRow(
        indexData.content,
        form.name.trim(),
        doc,
        "📋 Defined",
        form.priority,
        form.description.trim()
      );

      const updateRes = await fetch("/api/workspace/file", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          path: "projects/INDEX.md",
          content: updatedIndex,
        }),
      });
      if (!updateRes.ok) {
        throw new Error("Failed to update INDEX.md");
      }

      onCreated();
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
      setCreating(false);
    }
  }, [form, agentId, onCreated, handleClose]);

  return (
    <Dialog.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-background/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-[100] flex w-full flex-col overflow-hidden bg-card shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:border-border data-[state=closed]:sm:fade-out-0 data-[state=open]:sm:fade-in-0 data-[state=closed]:sm:zoom-out-95 data-[state=open]:sm:zoom-in-95 data-[state=closed]:sm:slide-out-to-left-1/2 data-[state=closed]:sm:slide-out-to-top-[48%] data-[state=open]:sm:slide-in-from-left-1/2 data-[state=open]:sm:slide-in-from-top-[48%]"
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-3">
            <div className="flex items-center gap-2">
              {step !== "type-select" && (
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/65"
                  onClick={() => setStep("type-select")}
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary" />
                <Dialog.Title className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  New Project
                </Dialog.Title>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/65"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Error */}
          {error && (
            <div className="shrink-0 bg-destructive/10 px-4 py-2 text-center text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Content */}
          <div className="overflow-y-auto">
            {step === "type-select" && (
              <TypeSelectStep onSelect={handleSelectType} />
            )}
            {step === "details" && (
              <DetailsStep
                form={form}
                creating={creating}
                onChange={setForm}
                onCreate={handleCreate}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});

// ─── Step: Type Select ───────────────────────────────────────────────────────

const TypeSelectStep = memo(function TypeSelectStep({
  onSelect,
}: {
  onSelect: (type: ProjectType) => void;
}) {
  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="text-center">
        <h2 className="text-lg font-semibold text-foreground">
          What kind of project?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a category. Your agent will flesh out the details.
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
    </div>
  );
});

// ─── Step: Details Form ──────────────────────────────────────────────────────

const DetailsStep = memo(function DetailsStep({
  form,
  creating,
  onChange,
  onCreate,
}: {
  form: ProjectForm;
  creating: boolean;
  onChange: (form: ProjectForm) => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col gap-5 p-6">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="project-name"
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          Project Name
        </label>
        <input
          id="project-name"
          type="text"
          placeholder="e.g. Notifications Panel"
          value={form.name}
          onChange={(e) => onChange({ ...form, name: e.target.value })}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
          autoFocus
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="project-desc"
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
        >
          Description
        </label>
        <textarea
          id="project-desc"
          rows={3}
          placeholder="What does this project accomplish? One or two sentences."
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          className="resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
        />
      </div>

      {/* Priority */}
      <div className="flex flex-col gap-1.5">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Priority
        </span>
        <div className="flex gap-2">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs transition ${
                form.priority === opt.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card/70 text-muted-foreground hover:border-border hover:bg-muted/40"
              }`}
              onClick={() =>
                onChange({ ...form, priority: opt.value as ProjectForm["priority"] })
              }
            >
              <span className={`h-2 w-2 rounded-full ${opt.dot}`} />
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Create Button */}
      <button
        type="button"
        disabled={creating || !form.name.trim() || !form.description.trim()}
        className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onCreate}
      >
        {creating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Creating…
          </>
        ) : (
          <>
            <FolderGit2 className="h-4 w-4" />
            Create Project
          </>
        )}
      </button>

      <p className="text-center text-[10px] text-muted-foreground/60">
        Creates a project file in your agent&apos;s workspace with a starter template.
      </p>
    </div>
  );
});
