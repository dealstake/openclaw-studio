"use client";

import React from "react";
import type { ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ModalOverlay } from "@/components/ModalOverlay";
import { X } from "lucide-react";

import { PanelIconButton } from "@/components/PanelIconButton";
import { sectionLabelClass } from "@/components/SectionLabel";

interface PanelExpandModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

export const PanelExpandModal = React.memo(function PanelExpandModal({
  open,
  onOpenChange,
  title,
  children,
}: PanelExpandModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <ModalOverlay />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[var(--z-modal)] flex h-screen w-screen -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-none border border-border bg-card shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 xl:h-[90vh] xl:w-[95vw] xl:max-w-7xl xl:rounded-lg"
          data-panel-expand-modal
          aria-describedby={undefined}
        >
          <Dialog.Title className="sr-only">{title}</Dialog.Title>

          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border/40 px-4 py-3">
            <span className={`${sectionLabelClass} text-muted-foreground`}>
              {title}
            </span>
            <PanelIconButton
              onClick={() => onOpenChange(false)}
              aria-label="Close expanded panel"
              data-testid="panel-expand-close-btn"
              className="min-h-[44px] min-w-[44px] xl:min-h-0 xl:min-w-0"
            >
              <X className="h-3.5 w-3.5" />
            </PanelIconButton>
          </div>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-hidden" data-testid="panel-expand-modal">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
