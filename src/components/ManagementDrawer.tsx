"use client";

import React, { type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { IconButton } from "@/components/IconButton";
import { sectionLabelClass } from "@/components/SectionLabel";

interface ManagementDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Width in px of the sidebar to the left of the drawer */
  sidebarOffsetPx: number;
  children: ReactNode;
}

/**
 * Slide-out management drawer that appears beside the sidebar.
 * On mobile (<640px), takes over the full screen for usability.
 * On desktop, overlays the chat area — sidebar remains visible.
 */
export const ManagementDrawer = React.memo(function ManagementDrawer({
  open,
  onOpenChange,
  title,
  sidebarOffsetPx,
  children,
}: ManagementDrawerProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Backdrop — on mobile covers everything, on desktop covers right of sidebar */}
        <Dialog.Overlay
          className="fixed inset-0 z-40 bg-background/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200 sm:left-[var(--sidebar-offset)]"
          style={{ "--sidebar-offset": `${sidebarOffsetPx}px` } as React.CSSProperties}
        />

        {/* Drawer panel — full-screen on mobile, fixed-width beside sidebar on desktop */}
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-card/95 border-r border-border shadow-[4px_0_32px_-8px_rgba(0,0,0,0.5)] backdrop-blur-xl
            sm:inset-auto sm:top-0 sm:left-[var(--sidebar-offset)] sm:h-full sm:w-[400px]
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:slide-out-to-left
            data-[state=open]:slide-in-from-left
            duration-200 ease-out"
          style={{ "--sidebar-offset": `${sidebarOffsetPx}px` } as React.CSSProperties}
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/30 px-4">
            <Dialog.Title className={sectionLabelClass}>
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <IconButton aria-label="Close panel" className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0">
                <X className="h-3.5 w-3.5" />
              </IconButton>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
});
