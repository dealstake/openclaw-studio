"use client";

import { memo, useState, useRef, useEffect } from "react";
import { Menu, MoreHorizontal, ShieldAlert } from "lucide-react";
import { CONTEXT_TAB_CONFIG } from "@/features/context/lib/tabs";
import type { ContextTab } from "@/features/context/components/ContextPanel";
import { useEmergencyOptional } from "@/features/emergency/EmergencyProvider";

/** Primary tabs shown directly in the bottom nav (max 4 for comfortable tap targets). */
const PRIMARY_TABS = ["projects", "tasks", "brain", "activity"] as const;
const PRIMARY_TAB_SET = new Set<string>(PRIMARY_TABS);

interface MobileBottomNavProps {
  onOpenSessionDrawer: () => void;
  contextTab: ContextTab;
  contextPanelOpen: boolean;
  onContextTabClick: (tab: ContextTab) => void;
  visible: boolean;
}

export const MobileBottomNav = memo(function MobileBottomNav({
  onOpenSessionDrawer,
  contextTab,
  contextPanelOpen,
  onContextTabClick,
  visible,
}: MobileBottomNavProps) {
  const emergency = useEmergencyOptional();
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Close "more" popover on outside click
  useEffect(() => {
    if (!moreOpen) return;
    function handleClick(e: MouseEvent) {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [moreOpen]);

  const overflowTabs = CONTEXT_TAB_CONFIG.filter(
    (t) => !PRIMARY_TAB_SET.has(t.value),
  );

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-[var(--z-header)] flex items-stretch justify-around border-t border-border/40 bg-background/95 backdrop-blur-xl lg:hidden safe-area-bottom transform-gpu transition-all duration-300 ease-in-out ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 translate-y-4 pointer-events-none"
      }`}
      data-testid="mobile-bottom-nav"
      aria-label="Mobile navigation"
    >
      {/* Sessions / hamburger */}
      <button
        type="button"
        onClick={onOpenSessionDrawer}
        className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 text-muted-foreground transition-colors active:bg-muted/60"
        aria-label="Sessions"
      >
        <Menu className="h-5 w-5" />
        <span className="text-[10px] font-medium leading-none">Sessions</span>
      </button>

      {/* Primary context tabs */}
      {CONTEXT_TAB_CONFIG.filter((t) => PRIMARY_TAB_SET.has(t.value)).map(
        ({ value, shortLabel, Icon }) => {
          const isActive = contextPanelOpen && contextTab === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onContextTabClick(value as ContextTab)}
              className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 transition-colors active:bg-muted/60 ${
                isActive
                  ? "text-accent-foreground"
                  : "text-muted-foreground"
              }`}
              aria-label={
                CONTEXT_TAB_CONFIG.find((c) => c.value === value)?.label ?? value
              }
            >
              <Icon
                className={`h-5 w-5 ${isActive ? "text-primary" : ""}`}
              />
              <span className="text-[10px] font-medium leading-none">
                {shortLabel}
              </span>
            </button>
          );
        },
      )}

      {/* More — overflow tabs + emergency */}
      <div className="relative flex flex-1" ref={moreRef}>
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 transition-colors active:bg-muted/60 ${
            moreOpen ? "text-accent-foreground" : "text-muted-foreground"
          }`}
          aria-label="More options"
          aria-expanded={moreOpen}
        >
          <MoreHorizontal className="h-5 w-5" />
          <span className="text-[10px] font-medium leading-none">More</span>
        </button>

        {moreOpen && (
          <div className="absolute bottom-full right-0 mb-2 min-w-48 rounded-lg border border-border/80 bg-popover/95 p-1.5 shadow-xl backdrop-blur-xl">
            {overflowTabs.map(({ value, label, Icon }) => {
              const isActive = contextPanelOpen && contextTab === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    onContextTabClick(value as ContextTab);
                    setMoreOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-[13px] font-medium transition-colors min-h-[44px] ${
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4 text-foreground/70" />
                  {label}
                </button>
              );
            })}
            {emergency && (
              <>
                <div className="my-1 border-t border-border/40" />
                <button
                  type="button"
                  onClick={() => {
                    emergency.toggle();
                    setMoreOpen(false);
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted min-h-[44px]"
                >
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  Emergency
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  );
});
