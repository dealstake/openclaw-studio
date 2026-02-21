"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ModalOverlay } from "@/components/ModalOverlay";
import {
  X,
  ArrowLeft,
  Sparkles,
  Loader2,
} from "lucide-react";
import { appendRow } from "../lib/indexTable";
import { sectionLabelClass } from "@/components/SectionLabel";
import { WizardChat } from "@/components/chat/WizardChat";
import { createConfigExtractor } from "@/components/chat/wizardConfigExtractor";
import {
  buildProjectWizardPrompt,
  getTypeGuide,
  getProjectWizardStarters,
} from "../lib/projectWizardPrompt";
import {
  ProjectPreviewCard,
  type ProjectConfig,
} from "./ProjectPreviewCard";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { TYPE_CARDS, type ProjectType } from "../lib/constants";
import { slugify, generateMarkdown } from "../lib/projectMarkdown";

// ─── Types ───────────────────────────────────────────────────────────────────

type WizardStep = "type-select" | "chat";

interface ProjectWizardModalProps {
  open: boolean;
  agentId: string;
  client: GatewayClient | null;
  onClose: () => void;
  onCreated: () => void;
}

// ─── Config extractor ────────────────────────────────────────────────────────

const projectConfigExtractor = createConfigExtractor("project");

// ─── Component ───────────────────────────────────────────────────────────────

export const ProjectWizardModal = memo(function ProjectWizardModal({
  open,
  agentId,
  client,
  onClose,
  onCreated,
}: ProjectWizardModalProps) {
  const [step, setStep] = useState<WizardStep>("type-select");
  const [selectedType, setSelectedType] = useState<ProjectType>("feature");
  const [previewConfig, setPreviewConfig] = useState<ProjectConfig | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [existingProjects, setExistingProjects] = useState<string[]>([]);
  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep("type-select");
      setSelectedType("feature");
      setPreviewConfig(null);
      setError(null);
      setCreating(false);
    }
  }, [open]);

  // Fetch existing project names when modal opens
  useEffect(() => {
    if (!open || !agentId) return;
    (async () => {
      try {
        const res = await fetch(
          `/api/workspace/file?agentId=${encodeURIComponent(agentId)}&path=projects/INDEX.md`,
        );
        if (!res.ok) return;
        const data = (await res.json()) as { content?: string };
        if (!data.content) return;
        // Parse project names from table rows
        const names: string[] = [];
        for (const line of data.content.split("\n")) {
          const match = line.match(/^\|\s*([^|]+?)\s*\|/);
          if (match && match[1] && !match[1].startsWith("Project") && !match[1].startsWith("-")) {
            names.push(match[1].trim());
          }
        }
        setExistingProjects(names);
      } catch {
        // Non-critical — wizard works without existing project list
      }
    })();
  }, [open, agentId]);

  const handleSelectType = useCallback((type: ProjectType) => {
    setSelectedType(type);
    setStep("chat");
  }, []);

  const handleConfigExtracted = useCallback((config: unknown) => {
    setPreviewConfig(config as ProjectConfig);
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!previewConfig) return;

    setCreating(true);
    setError(null);

    const slug = previewConfig.slug || slugify(previewConfig.name);
    const doc = `${slug}.md`;
    const markdown = generateMarkdown(previewConfig);

    try {
      // Check if project file already exists
      const checkRes = await fetch(
        `/api/workspace/file?agentId=${encodeURIComponent(agentId)}&path=projects/${encodeURIComponent(doc)}`,
      );
      if (checkRes.ok) {
        const checkData = (await checkRes.json()) as { content?: string };
        if (checkData.content && !checkData.content.startsWith("<!-- Archived:")) {
          setError(`A project file "${doc}" already exists. Choose a different name.`);
          setCreating(false);
          return;
        }
      }

      // Write the project file
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
        throw new Error(
          (data as { error?: string }).error || `Write failed: ${writeRes.status}`,
        );
      }

      // Read INDEX.md
      const indexRes = await fetch(
        `/api/workspace/file?agentId=${encodeURIComponent(agentId)}&path=projects/INDEX.md`,
      );
      if (!indexRes.ok) throw new Error("Could not read projects/INDEX.md");
      const indexData = (await indexRes.json()) as { content?: string };
      if (!indexData.content) throw new Error("projects/INDEX.md is empty");

      // Append row and write back
      const updatedIndex = appendRow(
        indexData.content,
        previewConfig.name.trim(),
        doc,
        "📋 Defined",
        previewConfig.priority,
        previewConfig.description.trim(),
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
      if (!updateRes.ok) throw new Error("Failed to update INDEX.md");

      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project.");
      setCreating(false);
    }
  }, [previewConfig, agentId, onCreated, onClose]);

  const handleRevise = useCallback(() => {
    setPreviewConfig(null);
  }, []);

  // Build system prompt with type-specific guidance
  const systemPrompt = useMemo(() => {
    const base = buildProjectWizardPrompt(agentId, existingProjects);
    const typeGuide = getTypeGuide(selectedType);
    return `${base}\n\n## Selected Project Type\n${typeGuide}`;
  }, [agentId, existingProjects, selectedType]);

  const starters = useMemo(() => getProjectWizardStarters(), []);

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Dialog.Portal>
        <ModalOverlay />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-[100] flex w-full flex-col overflow-hidden bg-card shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[85vh] sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:border sm:border-border data-[state=closed]:sm:fade-out-0 data-[state=open]:sm:fade-in-0 data-[state=closed]:sm:zoom-out-95 data-[state=open]:sm:zoom-in-95 data-[state=closed]:sm:slide-out-to-left-1/2 data-[state=closed]:sm:slide-out-to-top-[48%] data-[state=open]:sm:slide-in-from-left-1/2 data-[state=open]:sm:slide-in-from-top-[48%]"
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-3">
            <div className="flex items-center gap-2">
              {step !== "type-select" && (
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted/65"
                  onClick={() => {
                    setStep("type-select");
                    setPreviewConfig(null);
                  }}
                  aria-label="Go back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-primary-text" />
                <Dialog.Title
                  className={`${sectionLabelClass} text-muted-foreground`}
                >
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
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {step === "type-select" && (
              <div className="overflow-y-auto">
                <TypeSelectStep onSelect={handleSelectType} />
              </div>
            )}
            {step === "chat" && client && (
              <div className="relative flex min-h-0 flex-1 flex-col">
                {/* Preview card overlay */}
                {previewConfig && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
                    <ProjectPreviewCard
                      config={previewConfig}
                      onConfirm={handleConfirm}
                      onRevise={handleRevise}
                      className="w-full max-w-md"
                    />
                    {creating && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creating project…
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <WizardChat
                  client={client}
                  agentId={agentId}
                  wizardType="project"
                  systemPrompt={systemPrompt}
                  starters={starters}
                  onConfigExtracted={handleConfigExtracted}
                  configExtractor={projectConfigExtractor}
                  className="h-[60vh]"
                />
              </div>
            )}
            {step === "chat" && !client && (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                Connecting to gateway…
              </div>
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
          Choose a category — then describe your idea to the AI.
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {TYPE_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.type}
              type="button"
              className={`flex items-start gap-4 rounded-lg border bg-card/70 p-5 text-left transition ${card.color}`}
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
