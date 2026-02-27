"use client";

import React, { useCallback, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  CredentialMetadata,
  CredentialTemplate,
  CredentialValues,
} from "../lib/types";
import { TemplateGrid } from "./TemplateGrid";
import { SetupForm } from "./SetupForm";

export interface AddCredentialSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    metadata: Omit<CredentialMetadata, "id" | "createdAt" | "configPaths">,
    values: CredentialValues,
    template: CredentialTemplate,
  ) => Promise<void>;
}

type Step = "select" | "setup";

/** Custom credential template for arbitrary services. */
const CUSTOM_TEMPLATE: CredentialTemplate = {
  key: "custom",
  serviceName: "Custom Service",
  type: "api_key",
  category: "custom",
  serviceUrl: "",
  apiKeyPageUrl: "",
  instructions: "Enter the API key or secret for your custom service.",
  fields: [
    {
      id: "apiKey",
      label: "API Key / Secret",
      placeholder: "paste your key here",
      type: "password",
      required: true,
    },
  ],
  configPathMap: {
    apiKey: [],
  },
};

export const AddCredentialSheet = React.memo(function AddCredentialSheet({
  open,
  onOpenChange,
  onSave,
}: AddCredentialSheetProps) {
  const [step, setStep] = useState<Step>("select");
  const [selectedTemplate, setSelectedTemplate] =
    useState<CredentialTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");

  const reset = useCallback(() => {
    setStep("select");
    setSelectedTemplate(null);
    setSaving(false);
    setSearch("");
  }, []);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) reset();
      onOpenChange(isOpen);
    },
    [onOpenChange, reset],
  );

  const handleSelectTemplate = useCallback((template: CredentialTemplate) => {
    setSelectedTemplate(template);
    setStep("setup");
    setSearch("");
  }, []);

  const handleSelectCustom = useCallback(() => {
    setSelectedTemplate(CUSTOM_TEMPLATE);
    setStep("setup");
    setSearch("");
  }, []);

  const handleSave = useCallback(
    async (
      values: CredentialValues,
      overrides: { humanName?: string; description?: string },
    ) => {
      if (!selectedTemplate) return;
      setSaving(true);
      try {
        await onSave(
          {
            humanName: overrides.humanName ?? selectedTemplate.serviceName,
            type: selectedTemplate.type,
            serviceName: selectedTemplate.serviceName,
            templateKey: selectedTemplate.key,
            description: overrides.description,
            serviceUrl: selectedTemplate.serviceUrl || undefined,
            apiKeyPageUrl: selectedTemplate.apiKeyPageUrl || undefined,
            category: selectedTemplate.category,
          },
          values,
          selectedTemplate,
        );
        handleOpenChange(false);
      } catch {
        // Error handled by parent hook
      } finally {
        setSaving(false);
      }
    },
    [selectedTemplate, onSave, handleOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="fixed inset-y-0 right-0 left-auto m-0 flex h-full w-full max-w-md flex-col rounded-none border-l sm:rounded-none"
        aria-describedby={undefined}
      >
        <DialogHeader className="flex-row items-center gap-2 space-y-0 border-b border-border/30 pb-3">
          {step === "setup" && (
            <button
              type="button"
              onClick={() => setStep("select")}
              className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Back to template selection"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <DialogTitle className="flex-1 text-sm font-medium">
            {step === "select" ? "Add Credential" : selectedTemplate?.serviceName}
          </DialogTitle>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-1 py-3">
          {step === "select" && (
            <div className="space-y-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search services…"
                className="h-9 w-full rounded-md border border-border/50 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              />
              <TemplateGrid
                onSelectTemplate={handleSelectTemplate}
                onSelectCustom={handleSelectCustom}
                search={search}
              />
            </div>
          )}
          {step === "setup" && selectedTemplate && (
            <SetupForm
              template={selectedTemplate}
              onSave={handleSave}
              onCancel={() => setStep("select")}
              saving={saving}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
});
