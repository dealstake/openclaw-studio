"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  SideSheet,
  SideSheetContent,
  SideSheetHeader,
  SideSheetTitle,
  SideSheetClose,
  SideSheetBody,
} from "@/components/ui/SideSheet";
import { BaseCard, CardHeader, CardTitle } from "@/components/ui/BaseCard";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { CHANNEL_TEMPLATES, findChannelTemplate } from "../lib/channelTemplates";
import type { ChannelConfig, ChannelEntry, ChannelTemplate } from "../lib/types";
import { ChannelSetupForm } from "./ChannelSetupForm";
import { WhatsAppQRFlow } from "./WhatsAppQRFlow";

export interface ChannelSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (channelId: string, config: ChannelConfig) => Promise<void>;
  onUpdate: (channelId: string, updates: Partial<ChannelConfig>) => Promise<void>;
  readConfig: (channelId: string) => Promise<Record<string, unknown> | null>;
  /** Gateway client — required for WhatsApp QR flow */
  client: GatewayClient;
  /** When set: skip template selection, pre-populate form, show Edit title */
  editingChannel?: ChannelEntry | null;
}

type Step = "select" | "setup" | "qr_flow";

// ── Template selection grid ──────────────────────────────────────────────────

const TemplateCard = React.memo(function TemplateCard({
  template,
  onClick,
}: {
  template: ChannelTemplate;
  onClick: () => void;
}) {
  return (
    <BaseCard
      variant="compact"
      isHoverable
      onClick={onClick}
      aria-label={`Add ${template.label} channel`}
    >
      <CardHeader>
        <span className="shrink-0 text-xl" aria-hidden="true">
          {template.icon}
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle as="div">{template.label}</CardTitle>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {template.description}
          </p>
        </div>
      </CardHeader>
    </BaseCard>
  );
});

// ── Main component ───────────────────────────────────────────────────────────

export const ChannelSheet = React.memo(function ChannelSheet({
  open,
  onOpenChange,
  onCreate,
  onUpdate,
  readConfig,
  client,
  editingChannel,
}: ChannelSheetProps) {
  const isEditMode = !!editingChannel;

  const [step, setStep] = useState<Step>("select");
  const [selectedTemplate, setSelectedTemplate] = useState<ChannelTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [editInitialValues, setEditInitialValues] = useState<
    Record<string, unknown> | undefined
  >(undefined);
  const [loadingValues, setLoadingValues] = useState(false);
  // Stores the config values collected in setup step before QR flow
  const [configForQrFlow, setConfigForQrFlow] = useState<Partial<ChannelConfig> | null>(null);

  // Edit mode: load existing config and jump to setup
  useEffect(() => {
    if (open && editingChannel) {
      setStep("setup");
      const template = findChannelTemplate(editingChannel.channelId);
      setSelectedTemplate(template ?? null);
      setLoadingValues(true);
      readConfig(editingChannel.channelId)
        .then((values) => setEditInitialValues(values ?? {}))
        .catch(() => setEditInitialValues({}))
        .finally(() => setLoadingValues(false));
    }
  }, [open, editingChannel, readConfig]);

  const reset = useCallback(() => {
    setStep("select");
    setSelectedTemplate(null);
    setSaving(false);
    setEditInitialValues(undefined);
    setLoadingValues(false);
    setConfigForQrFlow(null);
  }, []);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) reset();
      onOpenChange(isOpen);
    },
    [onOpenChange, reset],
  );

  const handleSelectTemplate = useCallback((template: ChannelTemplate) => {
    setSelectedTemplate(template);
    setStep("setup");
  }, []);

  const handleSave = useCallback(
    async (values: Record<string, unknown>) => {
      if (!selectedTemplate) return;

      // WhatsApp add flow: save policy config then show QR
      if (selectedTemplate.hasQrFlow && !isEditMode) {
        setConfigForQrFlow(values as Partial<ChannelConfig>);
        setStep("qr_flow");
        return;
      }

      setSaving(true);
      try {
        if (isEditMode && editingChannel) {
          await onUpdate(editingChannel.channelId, values as Partial<ChannelConfig>);
        } else {
          await onCreate(selectedTemplate.id, values as ChannelConfig);
        }
        handleOpenChange(false);
      } catch {
        // Error handled by the hook; surface via parent error state
      } finally {
        setSaving(false);
      }
    },
    [selectedTemplate, isEditMode, editingChannel, onUpdate, onCreate, handleOpenChange],
  );

  const handleQrSuccess = useCallback(async () => {
    // WhatsApp connected — persist the config (policy fields) then close
    const config: ChannelConfig = (configForQrFlow ?? {}) as ChannelConfig;
    try {
      await onCreate("whatsapp", config);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to save WhatsApp config — check channel settings.",
      );
    }
    handleOpenChange(false);
  }, [configForQrFlow, onCreate, handleOpenChange]);

  // ── Title logic ──────────────────────────────────────────────────────────
  const sheetTitle = isEditMode
    ? `Edit — ${editingChannel?.template?.label ?? editingChannel?.channelId}`
    : step === "select"
      ? "Add Channel"
      : step === "qr_flow"
        ? "WhatsApp Pairing"
        : (selectedTemplate?.label ?? "Configure Channel");

  return (
    <SideSheet open={open} onOpenChange={handleOpenChange}>
      <SideSheetContent aria-describedby={undefined}>
        <SideSheetHeader>
          <div className="flex flex-1 items-center gap-2">
            {((step === "setup" && !isEditMode) || step === "qr_flow") && (
              <button
                type="button"
                onClick={() => setStep(step === "qr_flow" ? "setup" : "select")}
                className="flex h-11 w-11 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
                aria-label={step === "qr_flow" ? "Back to setup" : "Back to channel selection"}
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
          {/* Step: Template selection */}
          {step === "select" && !isEditMode && (
            <div className="flex flex-col gap-2">
              {CHANNEL_TEMPLATES.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onClick={() => handleSelectTemplate(template)}
                />
              ))}
            </div>
          )}

          {/* Step: Setup form */}
          {step === "setup" && selectedTemplate && !loadingValues && (
            <ChannelSetupForm
              template={selectedTemplate}
              initialValues={isEditMode ? editInitialValues : undefined}
              onSave={handleSave}
              onCancel={
                isEditMode ? () => handleOpenChange(false) : () => setStep("select")
              }
              saving={saving}
            />
          )}

          {/* Loading values for edit mode */}
          {loadingValues && (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Loading…
            </div>
          )}

          {/* Step: WhatsApp QR pairing */}
          {step === "qr_flow" && (
            <WhatsAppQRFlow
              client={client}
              onComplete={handleQrSuccess}
              onCancel={() => setStep("setup")}
            />
          )}
        </SideSheetBody>
      </SideSheetContent>
    </SideSheet>
  );
});
