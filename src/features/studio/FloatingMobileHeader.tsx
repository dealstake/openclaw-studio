"use client";

import { memo, useState, useRef, useEffect } from "react";
import {
  Menu,
  Ellipsis,
  FolderKanban,
  ListChecks,
  Brain,
  FolderOpen,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { HeaderIconButton } from "@/components/HeaderIconButton";
import { useEmergencyOptional } from "@/features/emergency/EmergencyProvider";
import type { ContextTab } from "@/features/context/components/ContextPanel";

const CONTEXT_TAB_ITEMS: Array<{
  value: ContextTab;
  label: string;
  Icon: typeof FolderKanban;
}> = [
  { value: "projects", label: "Projects", Icon: FolderKanban },
  { value: "tasks", label: "Tasks", Icon: ListChecks },
  { value: "brain", label: "Brain", Icon: Brain },
  { value: "workspace", label: "Files", Icon: FolderOpen },
  { value: "activity", label: "Activity", Icon: Activity },
];

interface FloatingMobileHeaderProps {
  onOpenSessionHistory: () => void;
  contextTab: ContextTab;
  contextPanelOpen: boolean;
  onContextTabClick: (tab: ContextTab) => void;
  visible: boolean;
}

export const FloatingMobileHeader = memo(function FloatingMobileHeader({
  onOpenSessionHistory,
  contextTab,
  contextPanelOpen,
  onContextTabClick,
  visible,
}: FloatingMobileHeaderProps) {
  const emergency = useEmergencyOptional();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const menuItemClass =
    "flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-xs font-medium text-foreground transition hover:bg-muted min-h-[44px]";

  return (
    <div
      className={`fixed top-0 inset-x-0 z-[var(--z-header)] flex items-center justify-between px-3 py-1.5 lg:hidden transform-gpu transition-all duration-300 ease-in-out ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-4 pointer-events-none"
      }`}
      data-testid="floating-mobile-header"
    >
      {/* Left: hamburger */}
      <HeaderIconButton
        onClick={onOpenSessionHistory}
        aria-label="Open session history"
        className="min-h-[44px] min-w-[44px] rounded-full bg-background/70 shadow-lg ring-1 ring-white/[0.08] backdrop-blur-lg"
      >
        <Menu className="h-4 w-4" />
      </HeaderIconButton>

      {/* Right: context menu */}
      <div className="relative" ref={menuRef}>
        <HeaderIconButton
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Open context menu"
          className="min-h-[44px] min-w-[44px] rounded-full bg-background/70 shadow-lg ring-1 ring-white/[0.08] backdrop-blur-lg"
        >
          <Ellipsis className="h-4 w-4" />
        </HeaderIconButton>

        {menuOpen && (
          <div className="absolute right-0 top-12 z-[var(--z-popover)] min-w-48 rounded-md border border-border/80 bg-popover/95 p-1 shadow-lg backdrop-blur">
            {CONTEXT_TAB_ITEMS.map(({ value, label, Icon }) => {
              const isActive = contextPanelOpen && contextTab === value;
              return (
                <button
                  key={value}
                  className={`${menuItemClass} ${isActive ? "bg-accent text-accent-foreground" : ""}`}
                  type="button"
                  onClick={() => { onContextTabClick(value); setMenuOpen(false); }}
                >
                  <Icon className="h-3.5 w-3.5 text-foreground/70" />
                  {label}
                </button>
              );
            })}
            {emergency && (
              <>
                <div className="my-1 border-t border-border/40" />
                <button
                  className={menuItemClass}
                  type="button"
                  onClick={() => { emergency.toggle(); setMenuOpen(false); }}
                >
                  <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
                  Emergency
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
