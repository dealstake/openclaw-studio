"use client";

import { memo } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { MODAL_OVERLAY_CLASSES } from "@/components/ModalOverlay";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export const ConfirmDialog = memo(function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={MODAL_OVERLAY_CLASSES} />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[100] w-[90vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]">
          <AlertDialog.Title className="text-base font-semibold text-foreground">
            {title}
          </AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {description}
          </AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel className="inline-flex h-9 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground transition hover:bg-muted">
              {cancelLabel}
            </AlertDialog.Cancel>
            <AlertDialog.Action
              className={`inline-flex h-9 items-center rounded-lg px-4 text-sm font-medium text-white transition ${
                destructive
                  ? "bg-destructive hover:bg-destructive/90"
                  : "bg-primary hover:bg-primary/90"
              }`}
              onClick={onConfirm}
            >
              {confirmLabel}
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
});
