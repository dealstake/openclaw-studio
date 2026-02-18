"use client";

import { memo, useEffect, useRef, type FC } from "react";
import {
  ComposerPrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import { ArrowDownIcon, SendIcon } from "lucide-react";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";

// ─── Composer ────────────────────────────────────────────────────────────────
// Mobile fix: use env(safe-area-inset-bottom) and proper padding so the
// composer stays visible above the on-screen keyboard.

export const WizardComposer: FC = memo(function WizardComposer() {
  const composerRef = useRef<HTMLFormElement>(null);

  // When the mobile keyboard opens, scroll the composer into view
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      // Small viewport = keyboard is open — scroll composer into view
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    };
    vv.addEventListener("resize", handleResize);
    return () => vv.removeEventListener("resize", handleResize);
  }, []);

  return (
    <ComposerPrimitive.Root ref={composerRef} className="aui-composer-root flex w-full items-end gap-2 pb-[env(safe-area-inset-bottom)]">
      <ComposerPrimitive.Input
        autoFocus
        placeholder="Describe what you want this task to do…"
        className="aui-composer-input min-h-[40px] max-h-[120px] flex-1 resize-none rounded-lg border border-border/80 bg-muted/30 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none"
        submitOnEnter
      />
      <ComposerPrimitive.Send asChild>
        <TooltipIconButton
          tooltip="Send"
          variant="default"
          className="aui-composer-send h-10 w-10 shrink-0 rounded-lg transition"
        >
          <SendIcon />
        </TooltipIconButton>
      </ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
  );
});

// ─── Scroll to bottom ────────────────────────────────────────────────────────

export const ThreadScrollToBottom: FC = memo(function ThreadScrollToBottom() {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        className="aui-thread-scroll-to-bottom mb-2 rounded-full border border-border bg-card shadow-sm"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
});
