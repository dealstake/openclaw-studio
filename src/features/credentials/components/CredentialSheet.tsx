"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  SideSheet,
  SideSheetContent,
  SideSheetHeader,
  SideSheetTitle,
  SideSheetClose,
  SideSheetBody,
} from "@/components/ui/SideSheet";
import type {
  Credential,
  CredentialMetadata,
  CredentialTemplate,
  CredentialValues,
} from "../lib/types";
import { TemplateGrid } from "./TemplateGrid";
import { SetupForm } from "./SetupForm";
import { findTemplate } from "../lib/templates";

export interface CredentialSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when creating a new credential */
  onSave: (
    metadata: Omit<CredentialMetadata, "id" | "createdAt" | "configPaths">,
    values: CredentialValues,
    template: CredentialTemplate,
  ) => Promise<void>;
  /** Credential being edited (null = add mode) */
  editing?: Credential | null;
  /** Called when saving edits to an existing credential */
  onEditSave?: (
    values: CredentialValues,
    overrides: { humanName?: string; description?: string },
  ) => Promise<void>;
  /** Function to read current secret values for pre-population */
  readSecretValues?: (credential: Credential) => Promise<CredentialValues>;
  /** Pre-select a template by key, skipping the template selection step */
  initialTemplateKey?: string;
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

export const CredentialSheet = React.memo(function CredentialSheet({
  open,
  onOpenChange,
  onSave,
  editing,
  onEditSave,
  readSecretValues,
  initialTemplateKey,
}: CredentialSheetProps) {
  const isEditMode = !!editing;
  const [step, setStep] = useState<Step>("select");
  const [selectedTemplate, setSelectedTemplate] =
    useState<CredentialTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editInitialValues, setEditInitialValues] = useState<CredentialValues | undefined>(undefined);
  const [loadingValues, setLoadingValues] = useState(false);

  // When opening with initialTemplateKey, skip to setup step
  useEffect(() => {
    if (open && !editing && initialTemplateKey) {
      const template = findTemplate(initialTemplateKey);
      if (template) {
        setSelectedTemplate(template);
        setStep("setup");
      }
    }
  }, [open, editing, initialTemplateKey]);

  // When opening in edit mode, load current values and go directly to setup
  useEffect(() => {
    if (open && editing) {
      setStep("setup");
      const template = editing.templateKey
        ? findTemplate(editing.templateKey)
        : null;
      setSelectedTemplate(template ?? CUSTOM_TEMPLATE);

      if (readSecretValues) {
        setLoadingValues(true);
        readSecretValues(editing)
          .then((values) => setEditInitialValues(values))
          .catch(() => setEditInitialValues({}))
          .finally(() => setLoadingValues(false));
      }
    }
  }, [open, editing, readSecretValues]);

  const reset = useCallback(() => {
    setStep("select");
    setSelectedTemplate(null);
    setSaving(false);
    setSearch("");
    setEditInitialValues(undefined);
    setLoadingValues(false);
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
      overrides: {
        humanName?: string;
        description?: string;
        customConfigPath?: string;
      },
    ) => {
      if (!selectedTemplate) return;
      setSaving(true);

      // For custom templates, inject the user-provided config path
      const resolvedTemplate =
        selectedTemplate.key === "custom" && overrides.customConfigPath
          ? {
              ...selectedTemplate,
              configPathMap: {
                apiKey: [overrides.customConfigPath.trim()],
              },
            }
          : selectedTemplate;

      try {
        if (isEditMode && onEditSave) {
          await onEditSave(values, overrides);
        } else {
          await onSave(
            {
              humanName: overrides.humanName ?? resolvedTemplate.serviceName,
              type: resolvedTemplate.type,
              serviceName: resolvedTemplate.serviceName,
              templateKey: resolvedTemplate.key,
              description: overrides.description,
              serviceUrl: resolvedTemplate.serviceUrl || undefined,
              apiKeyPageUrl: resolvedTemplate.apiKeyPageUrl || undefined,
              category: resolvedTemplate.category,
            },
            values,
            resolvedTemplate,
          );
        }
        handleOpenChange(false);
      } catch {
        // Error handled by parent hook
      } finally {
        setSaving(false);
      }
    },
    [selectedTemplate, isEditMode, onEditSave, onSave, handleOpenChange],
  );

  const sheetTitle = isEditMode
    ? `Edit — ${editing?.humanName}`
    : step === "select"
      ? "Add Service"
      : selectedTemplate?.serviceName;

  return (
    <SideSheet open={open} onOpenChange={handleOpenChange}>
      <SideSheetContent aria-describedby={undefined}>
        <SideSheetHeader>
          <div className="flex flex-1 items-center gap-2">
            {step === "setup" && !isEditMode && (
              <button
                type="button"
                onClick={() => setStep("select")}
                className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Back to template selection"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <SideSheetTitle className="flex-1 text-sm font-medium">
              {sheetTitle}
            </SideSheetTitle>
          </div>
          <SideSheetClose />
        </SideSheetHeader>

        <SideSheetBody className="px-1">
          {step === "select" && !isEditMode && (
            <div className="space-y-3">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search services…"
                className="h-9 w-full rounded-md border border-border/50 bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              />
              <TemplateGrid
                onSelectTemplate={handleSelectTemplate}
                onSelectCustom={handleSelectCustom}
                search={search}
              />
            </div>
          )}
          {step === "setup" && selectedTemplate && !loadingValues && (
            <SetupForm
              template={selectedTemplate}
              initialValues={isEditMode ? editInitialValues : undefined}
              onSave={handleSave}
              onCancel={isEditMode ? () => handleOpenChange(false) : () => setStep("select")}
              saving={saving}
            />
          )}
          {loadingValues && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Loading…
            </div>
          )}
        </SideSheetBody>
      </SideSheetContent>
    </SideSheet>
  );
});
