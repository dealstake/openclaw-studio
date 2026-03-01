"use client";

import { memo, useCallback, useState } from "react";
import {
  SideSheet,
  SideSheetContent,
  SideSheetHeader,
  SideSheetClose,
  SideSheetBody,
  SideSheetTitle,
} from "@/components/ui/SideSheet";
import { BaseCard } from "@/components/ui/BaseCard";
import { ENGINE_TEMPLATES } from "@/features/models/lib/engineRegistry";
import { ConfigureEngineForm } from "./ConfigureEngineForm";
import type {
  EngineTemplate,
  EngineType,
  SpecialistEngine,
} from "@/features/models/lib/types";

interface AddEngineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Existing engines — used to pre-fill when editing */
  existingEngines: SpecialistEngine[];
  /** Called on save */
  onSave: (
    type: EngineType,
    apiKey: string,
    model: string,
    fallbackModel: string | null,
  ) => Promise<void>;
  /** If set, skip gallery and go straight to configure for this engine */
  editEngine?: SpecialistEngine | null;
}

export const AddEngineDialog = memo(function AddEngineDialog({
  open,
  onOpenChange,
  existingEngines,
  onSave,
  editEngine,
}: AddEngineDialogProps) {
  const [selectedTemplate, setSelectedTemplate] =
    useState<EngineTemplate | null>(null);

  // If editing, find the template
  const activeTemplate = editEngine
    ? ENGINE_TEMPLATES.find((t) => t.type === editEngine.type) ?? null
    : selectedTemplate;

  const activeExisting = editEngine ?? 
    (activeTemplate
      ? existingEngines.find((e) => e.type === activeTemplate.type) ?? null
      : null);

  const handleClose = useCallback(() => {
    onOpenChange(false);
    // Reset selection after close animation
    setTimeout(() => setSelectedTemplate(null), 200);
  }, [onOpenChange]);

  const handleSave = useCallback(
    async (data: {
      apiKey: string;
      model: string;
      fallbackModel: string | null;
    }) => {
      if (!activeTemplate) return;
      await onSave(
        activeTemplate.type,
        data.apiKey,
        data.model,
        data.fallbackModel,
      );
      handleClose();
    },
    [activeTemplate, onSave, handleClose],
  );

  const handleBack = useCallback(() => {
    if (editEngine) {
      handleClose();
    } else {
      setSelectedTemplate(null);
    }
  }, [editEngine, handleClose]);

  // Filter out engines that are already configured (unless editing)
  const configuredTypes = new Set(
    existingEngines.filter((e) => e.enabled).map((e) => e.type),
  );

  return (
    <SideSheet open={open} onOpenChange={onOpenChange}>
      <SideSheetContent>
        <SideSheetHeader>
          <SideSheetTitle className="text-sm font-medium">
            {activeTemplate
              ? `Configure ${activeTemplate.displayName}`
              : "Add Specialist Engine"}
          </SideSheetTitle>
          <SideSheetClose />
        </SideSheetHeader>

        <SideSheetBody>
          {activeTemplate ? (
            <ConfigureEngineForm
              template={activeTemplate}
              existing={activeExisting}
              onSave={handleSave}
              onCancel={handleBack}
            />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-muted-foreground">
                Choose an AI to help your agent with specialized tasks.
              </p>
              {ENGINE_TEMPLATES.map((template) => {
                const alreadyConfigured = configuredTypes.has(template.type);
                return (
                  <BaseCard
                    key={template.type}
                    variant="default"
                    isHoverable
                    onClick={
                      alreadyConfigured
                        ? undefined
                        : () => setSelectedTemplate(template)
                    }
                    className={alreadyConfigured ? "opacity-50" : "cursor-pointer"}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 text-lg" aria-hidden>
                        {template.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">
                            {template.displayName}
                          </span>
                          {alreadyConfigured && (
                            <span className="text-xs text-muted-foreground">
                              Already added
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {template.description}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          Best for: {template.bestFor}
                        </p>
                      </div>
                    </div>
                  </BaseCard>
                );
              })}
            </div>
          )}
        </SideSheetBody>
      </SideSheetContent>
    </SideSheet>
  );
});
