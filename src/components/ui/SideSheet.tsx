"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

/**
 * SideSheet — a right-anchored slide-in panel built on Radix Dialog.
 *
 * Fixes the nested-dialog CSS bug where base DialogContent's
 * `top-[50%] translate-y-[-50%]` conflicts with side-sheet positioning.
 * Uses DialogPrimitive.Content directly (not the wrapped DialogContent)
 * to avoid double Portal/Overlay rendering.
 */

// Re-export Dialog root for convenience
export const SideSheet = DialogPrimitive.Root;

const SideSheetOverlay = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
      className,
    )}
    {...props}
  />
));
SideSheetOverlay.displayName = "SideSheetOverlay";

export const SideSheetContent = React.forwardRef<
  React.ComponentRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <SideSheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Side-sheet positioning — no transforms, no centering
        "fixed inset-y-0 right-0 z-50 m-0 flex h-full w-full max-w-md flex-col",
        "rounded-none border-l bg-background p-0 shadow-lg outline-none",
        // Slide animation
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right",
        "duration-200 ease-out",
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SideSheetContent.displayName = "SideSheetContent";

export function SideSheetHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex h-12 shrink-0 items-center justify-between border-b border-border/30 px-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SideSheetClose(
  props: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Close>,
) {
  return (
    <DialogPrimitive.Close
      className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:text-foreground"
      {...props}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Close</span>
    </DialogPrimitive.Close>
  );
}

export function SideSheetBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto px-4 py-3", className)}
      {...props}
    />
  );
}

export const SideSheetTitle = DialogPrimitive.Title;
export const SideSheetDescription = DialogPrimitive.Description;
