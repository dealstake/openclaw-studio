"use client";

/**
 * StudioContextDrawer — Positioning shell for context panel.
 *
 * Handles overlay/drawer/panel positioning and mobile swipe gestures.
 * Delegates ALL tab + panel content to ContextPanelContent.
 */

import React from "react";
import { ContextPanelContent, type ContextPanelContentProps } from "@/features/context/components/ContextPanelContent";

// Re-export for consumers
export type { ExpandableTab } from "@/hooks/useContextPanelState";

interface StudioContextDrawerProps extends ContextPanelContentProps {
  isMobileLayout: boolean;
  showContextInline: boolean;
  /** Tablet slide-over mode — shows drawer with backdrop, not inline */
  showContextSlideOver?: boolean;
  mobilePane: string;
  swipeDy: number;
  /**
   * When "panel", renders without any fixed/absolute positioning — the parent
   * PanelGroup handles geometry. Used on wide viewports with react-resizable-panels.
   */
  renderMode?: "overlay" | "panel";
  swipeHandlers: {
    onTouchStart?: React.TouchEventHandler;
    onTouchMove?: React.TouchEventHandler;
    onTouchEnd?: React.TouchEventHandler;
  };
  switchToChat: () => void;
}

export const StudioContextDrawer = React.memo(function StudioContextDrawer(props: StudioContextDrawerProps) {
  const {
    isMobileLayout, showContextInline, showContextSlideOver, mobilePane, swipeDy, swipeHandlers,
    switchToChat, renderMode = "overlay",
    // All ContextPanelContent props — destructure layout-specific, forward the rest
    onClose,
    ...contentProps
  } = props;

  // Panel mode: no positioning/sizing — parent PanelGroup handles it
  const containerClassName = renderMode === "panel"
    ? "h-full w-full pt-14 min-h-0 overflow-hidden p-0"
    : isMobileLayout
      ? `fixed inset-x-0 bottom-0 z-50 h-[70vh] rounded-t-3xl transform-gpu ${swipeDy > 0 ? "" : "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"} ${mobilePane === "context" ? "translate-y-0" : "translate-y-full"} bg-surface-elevated/95 backdrop-blur-xl ring-1 ring-white/[0.06] border-t border-border/50 min-h-0 overflow-hidden p-0 shadow-[0_-4px_24px_-6px_rgba(0,0,0,0.3)]`
      : `fixed inset-y-0 right-0 z-20 w-[300px] lg:w-[360px] pt-4 min-[1440px]:pt-20 pb-16 lg:pb-0 transform-gpu transition-transform duration-300 ease-out ${(showContextInline || showContextSlideOver) ? "translate-x-0" : "translate-x-full"} bg-surface-elevated/60 backdrop-blur-xl ring-1 ring-white/[0.06] min-h-0 overflow-hidden p-0 shadow-[-4px_0_24px_-6px_rgba(0,0,0,0.3)]`;

  const handleClose = showContextInline ? onClose : switchToChat;

  return (
    <>
      {/* Backdrop for tablet slide-over — click to dismiss */}
      {showContextSlideOver && renderMode !== "panel" && (
        <div
          className="fixed inset-0 z-[19] bg-black/40 backdrop-blur-[2px] transition-opacity duration-300"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}
      <div
        className={containerClassName}
        style={isMobileLayout && swipeDy > 0 && renderMode !== "panel" ? { transform: `translateY(${swipeDy}px)` } : undefined}
        onTouchStart={isMobileLayout && renderMode !== "panel" ? swipeHandlers.onTouchStart : undefined}
        onTouchMove={isMobileLayout && renderMode !== "panel" ? swipeHandlers.onTouchMove : undefined}
        onTouchEnd={isMobileLayout && renderMode !== "panel" ? swipeHandlers.onTouchEnd : undefined}
      >
        {isMobileLayout && (
          <div className="flex justify-center py-5 cursor-grab active:cursor-grabbing" aria-hidden="true">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        <ContextPanelContent
          onClose={handleClose}
          {...contentProps}
        />
      </div>
    </>
  );
});
