"use client";

import React, { type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { PanelIconButton } from "@/components/PanelIconButton";
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
 * Unlike PanelExpandModal (full-screen), this overlays the chat area only —
 * the sidebar remains visible on the left.
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
        {/* Backdrop — covers everything to the right of the sidebar */}
        <Dialog.Overlay
          className="fixed inset-0 z-40 bg-background/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200"
          style={{ left: sidebarOffsetPx }}
        />

        {/* Drawer panel */}
        <Dialog.Content
          className="fixed top-0 z-50 flex h-full w-[400px] flex-col overflow-hidden bg-card/95 border-r border-border shadow-[4px_0_32px_-8px_rgba(0,0,0,0.5)] backdrop-blur-xl
            data-[state=open]:animate-in data-[state=closed]:animate-out
            data-[state=closed]:slide-out-to-left
            data-[state=open]:slide-in-from-left
            duration-200 ease-out"
          style={{ left: sidebarOffsetPx }}
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/30 px-4">
            <Dialog.Title className={sectionLabelClass}>
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <PanelIconButton aria-label="Close panel" className="min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0">
                <X className="h-3.5 w-3.5" />
              </PanelIconButton>
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
