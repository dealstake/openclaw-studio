"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import {
  SideSheet,
  SideSheetContent,
  SideSheetHeader,
  SideSheetTitle,
  SideSheetClose,
  SideSheetBody,
} from "@/components/ui/SideSheet";
import { SectionLabel } from "@/components/SectionLabel";
import { cn } from "@/lib/utils";
import type {
  Credential,
  CredentialMetadata,
  CredentialTemplate,
  CredentialValues,
  ConnectionTestResult,
  SuggestedTask,
} from "../lib/types";
import { TemplateGrid } from "./TemplateGrid";
import { SetupForm } from "./SetupForm";
import { findTemplate } from "../lib/templates";
import { testConnection } from "../lib/testConnection";
import { toggleSkill } from "@/features/skills/lib/skillService";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";

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
  /** Gateway client for post-save skill auto-enable */
  client?: GatewayClient;
  /** Called when user wants to set up a suggested task */
  onLaunchTaskWizard?: (task: SuggestedTask) => void;
}

type Step = "select" | "setup" | "testing" | "next-steps";

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

// ── Post-save sub-components ─────────────────────────────────────────────────

const ConnectionTestStep = React.memo(function ConnectionTestStep({
  result,
  testing,
}: {
  result: ConnectionTestResult | null;
  testing: boolean;
}) {
  if (testing) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">
          Testing connection…
        </span>
      </div>
    );
  }
  if (!result) return null;
  return (
    <div
      role="status"
      className={cn(
        "rounded-md px-3 py-2 text-sm",
        result.success
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "bg-red-500/10 text-red-700 dark:text-red-400",
      )}
    >
      {result.success ? (
        <CheckCircle2 className="inline h-4 w-4 mr-1.5" />
      ) : (
        <AlertCircle className="inline h-4 w-4 mr-1.5" />
      )}
      {result.message}
    </div>
  );
});

const NextStepsStep = React.memo(function NextStepsStep({
  tasks,
  onSetupTask,
  onFinish,
}: {
  tasks: SuggestedTask[];
  onSetupTask: (task: SuggestedTask) => void;
  onFinish: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 p-4">
      <SectionLabel>What&apos;s next?</SectionLabel>
      {tasks.map((task) => (
        <div
          key={task.name}
          className="rounded-md border border-border/80 bg-card/75 p-3"
        >
          <p className="text-sm font-medium text-foreground">{task.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {task.description}
          </p>
          <button
            type="button"
            onClick={() => onSetupTask(task)}
            className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 min-h-[44px]"
            aria-label={`Set up ${task.name}`}
          >
            Set up now
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onFinish}
        className="mt-2 text-xs text-muted-foreground hover:text-foreground min-h-[44px]"
      >
        Done for now
      </button>
    </div>
  );
});

// ── Main component ───────────────────────────────────────────────────────────

export const CredentialSheet = React.memo(function CredentialSheet({
  open,
  onOpenChange,
  onSave,
  editing,
  onEditSave,
  readSecretValues,
  initialTemplateKey,
  client,
  onLaunchTaskWizard,
}: CredentialSheetProps) {
  const isEditMode = !!editing;
  const [step, setStep] = useState<Step>("select");
  const [selectedTemplate, setSelectedTemplate] =
    useState<CredentialTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editInitialValues, setEditInitialValues] = useState<
    CredentialValues | undefined
  >(undefined);
  const [loadingValues, setLoadingValues] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(
    null,
  );
  const [testing, setTesting] = useState(false);

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
    setTestResult(null);
    setTesting(false);
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

  const runPostSaveFlow = useCallback(
    async (template: CredentialTemplate, values: CredentialValues) => {
      // If template has testConfig, run the connection test
      if (template.testConfig) {
        setStep("testing");
        setTesting(true);

        const result = await testConnection(template.key, values);
        setTestResult(result);
        setTesting(false);

        // Auto-enable required skills on success
        if (result.success && template.requiredSkills && client) {
          for (const skill of template.requiredSkills) {
            try {
              await toggleSkill(client, skill, true);
            } catch {
              // Skill enable is best-effort
            }
          }
        }
      } else if (template.requiredSkills && client) {
        // No test but has required skills — enable them directly
        for (const skill of template.requiredSkills) {
          try {
            await toggleSkill(client, skill, true);
          } catch {
            // Best-effort
          }
        }
      }

      // If template has suggested tasks, show next-steps
      if (template.suggestedTasks?.length) {
        setStep("next-steps");
      } else if (template.testConfig) {
        // Stay on testing step to show result, auto-close after delay
        setTimeout(() => handleOpenChange(false), 2000);
      } else {
        handleOpenChange(false);
      }
    },
    [client, handleOpenChange],
  );

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
          handleOpenChange(false);
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
          // Run post-save flow instead of closing immediately
          await runPostSaveFlow(resolvedTemplate, values);
        }
      } catch {
        // Error handled by parent hook
      } finally {
        setSaving(false);
      }
    },
    [
      selectedTemplate,
      isEditMode,
      onEditSave,
      onSave,
      handleOpenChange,
      runPostSaveFlow,
    ],
  );

  const handleSetupTask = useCallback(
    (task: SuggestedTask) => {
      if (onLaunchTaskWizard) {
        onLaunchTaskWizard(task);
      } else {
        // Bubble up via custom event for panels that don't wire the callback
        window.dispatchEvent(
          new CustomEvent("openclaw:launch-task-wizard", {
            detail: { initialPrompt: task.templatePrompt },
          }),
        );
      }
      handleOpenChange(false);
    },
    [onLaunchTaskWizard, handleOpenChange],
  );

  const sheetTitle = isEditMode
    ? `Edit — ${editing?.humanName}`
    : step === "select"
      ? "Add Service"
      : step === "testing"
        ? "Testing Connection…"
        : step === "next-steps"
          ? "What's Next?"
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
                className="flex h-11 w-11 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
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
              onCancel={
                isEditMode ? () => handleOpenChange(false) : () => setStep("select")
              }
              saving={saving}
            />
          )}
          {step === "testing" && (
            <div className="p-4">
              <ConnectionTestStep result={testResult} testing={testing} />
            </div>
          )}
          {step === "next-steps" && selectedTemplate?.suggestedTasks && (
            <>
              {testResult && (
                <div className="px-4 pt-4">
                  <ConnectionTestStep result={testResult} testing={false} />
                </div>
              )}
              <NextStepsStep
                tasks={selectedTemplate.suggestedTasks}
                onSetupTask={handleSetupTask}
                onFinish={() => handleOpenChange(false)}
              />
            </>
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
