"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { ModalOverlay } from "@/components/ModalOverlay";
import { useDocumentTemplates } from "../hooks/useDocumentTemplates";
import type { DocTemplateEntry } from "@/features/personas/lib/documentTemplates";
import type { DriveFile } from "../types";

// ── Types ──────────────────────────────────────────────────────────────────────

type DocumentFormat = "pdf" | "docx" | "md";

interface GenerateDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the generated DriveFile on successful generation */
  onGenerated: (file: DriveFile) => void;
}

interface GenerateResponse {
  file: DriveFile;
}

function isGenerateResponse(value: unknown): value is GenerateResponse {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj.file === "object" && obj.file !== null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const FORMAT_OPTIONS: { value: DocumentFormat; label: string }[] = [
  { value: "pdf", label: "PDF (Google Drive printable)" },
  { value: "docx", label: "Word Document (.doc)" },
  { value: "md", label: "Markdown (.md)" },
];

/** Group templates by persona name */
function groupByPersona(
  templates: DocTemplateEntry[],
): Map<string, DocTemplateEntry[]> {
  const groups = new Map<string, DocTemplateEntry[]>();
  for (const t of templates) {
    const key = t.personaTemplateName;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  return groups;
}

// ── Component ──────────────────────────────────────────────────────────────────

export const GenerateDocumentDialog = memo(function GenerateDocumentDialog({
  open,
  onOpenChange,
  onGenerated,
}: GenerateDocumentDialogProps) {
  const { templates, loading: loadingTemplates, error: templatesError } = useDocumentTemplates();

  const [selectedTemplate, setSelectedTemplate] = useState<DocTemplateEntry | null>(null);
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<DocumentFormat>("pdf");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedTemplate(null);
      setTitle("");
      setFormat("pdf");
      setGenerating(false);
      setGenerateError(null);
    }
  }, [open]);

  // Pre-select first template when list loads
  useEffect(() => {
    if (templates.length > 0 && selectedTemplate === null) {
      setSelectedTemplate(templates[0] ?? null);
    }
  }, [templates, selectedTemplate]);

  const groups = useMemo(() => groupByPersona(templates), [templates]);

  const handleTemplateChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const [personaKey, filename] = e.target.value.split("||");
      const found = templates.find(
        (t) => t.personaTemplateKey === personaKey && t.filename === filename,
      );
      setSelectedTemplate(found ?? null);
      // Reset title when template changes
      setTitle("");
    },
    [templates],
  );

  const selectValue = selectedTemplate
    ? `${selectedTemplate.personaTemplateKey}||${selectedTemplate.filename}`
    : "";

  const handleGenerate = useCallback(async () => {
    if (!selectedTemplate) return;

    setGenerating(true);
    setGenerateError(null);

    const docTitle = title.trim() || selectedTemplate.label;

    try {
      const res = await fetch("/api/artifacts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personaTemplateKey: selectedTemplate.personaTemplateKey,
          templateFilename: selectedTemplate.filename,
          data: {
            title: docTitle,
            date: new Date().toISOString(),
          },
          format,
          title: docTitle,
        }),
      });

      if (!res.ok) {
        let message = `Generation failed (${res.status})`;
        try {
          const body = (await res.json()) as { error?: string };
          if (body.error) message = body.error;
        } catch {
          // non-JSON body
        }
        setGenerateError(message);
        return;
      }

      const data: unknown = await res.json();
      if (!isGenerateResponse(data)) {
        setGenerateError("Unexpected response from generation API.");
        return;
      }

      onGenerated(data.file);
      onOpenChange(false);
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Failed to generate document.");
    } finally {
      setGenerating(false);
    }
  }, [selectedTemplate, title, format, onGenerated, onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <ModalOverlay />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[var(--z-modal)] w-[90vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card p-6 shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="text-base font-semibold text-foreground">
              New Document from Template
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="mt-1 text-xs text-muted-foreground">
            Select a persona document template, choose a format, and generate a
            starter document uploaded directly to Google Drive.
          </Dialog.Description>

          {/* Body */}
          <div className="mt-5 flex flex-col gap-4">
            {/* Template selector */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="template-select"
                className="text-xs font-medium text-foreground"
              >
                Template
              </label>
              {loadingTemplates ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading templates…
                </div>
              ) : templatesError ? (
                <p className="text-xs text-destructive">{templatesError}</p>
              ) : templates.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No document templates found. Add{" "}
                  <code className="rounded bg-muted px-1 font-mono text-[10px]">
                    documentTemplates
                  </code>{" "}
                  to your persona Starter Kit.
                </p>
              ) : (
                <select
                  id="template-select"
                  value={selectValue}
                  onChange={handleTemplateChange}
                  className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                >
                  {Array.from(groups.entries()).map(([personaName, group]) => (
                    <optgroup key={personaName} label={personaName}>
                      {group.map((t) => (
                        <option
                          key={`${t.personaTemplateKey}||${t.filename}`}
                          value={`${t.personaTemplateKey}||${t.filename}`}
                        >
                          {t.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
              {selectedTemplate && (
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {selectedTemplate.description}
                  {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                    <> · Variables: {selectedTemplate.variables.join(", ")}</>
                  )}
                </p>
              )}
            </div>

            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="doc-title"
                className="text-xs font-medium text-foreground"
              >
                Document Title{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <input
                id="doc-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={selectedTemplate?.label ?? "Enter a title…"}
                maxLength={128}
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground placeholder:text-muted-foreground/60 transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              />
            </div>

            {/* Format */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-foreground">Format</span>
              <div className="flex flex-wrap gap-2">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormat(opt.value)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      format === opt.value
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            {generateError && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {generateError}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="mt-6 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-muted"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              disabled={generating || !selectedTemplate || loadingTemplates}
              onClick={() => void handleGenerate()}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {generating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {generating ? "Generating…" : "Generate & Upload"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
