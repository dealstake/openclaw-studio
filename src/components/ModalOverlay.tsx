"use client";

import { forwardRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";

/**
 * Standard overlay classes for all modal overlays in Studio.
 * Use this constant when you need AlertDialog.Overlay or other non-Dialog overlays.
 */
export const MODAL_OVERLAY_CLASSES =
  "fixed inset-0 z-[100] bg-background/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0";

/**
 * Shared Dialog.Overlay with standardized z-index, background, and animations.
 * Drop-in replacement for inline `<Dialog.Overlay className="..." />`.
 */
export const ModalOverlay = forwardRef<
  React.ComponentRef<typeof Dialog.Overlay>,
  React.ComponentPropsWithoutRef<typeof Dialog.Overlay>
>(function ModalOverlay({ className, ...props }, ref) {
  return (
    <Dialog.Overlay
      ref={ref}
      className={className ? `${MODAL_OVERLAY_CLASSES} ${className}` : MODAL_OVERLAY_CLASSES}
      {...props}
    />
  );
});
