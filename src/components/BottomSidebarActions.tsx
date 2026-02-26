"use client";

import { memo, useState, useRef, useEffect } from "react";
import { Settings } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { LogoutButton } from "@/components/brand/LogoutButton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type BottomSidebarActionsProps = {
  collapsed: boolean;
  onOpenSettings: () => void;
  settingsActive?: boolean;
};

/**
 * Bottom-left sidebar actions: Notifications (top), Theme (middle), Settings gear with dropdown (bottom).
 * Replaces the old Settings button + ThemeToggle in AppSidebar.
 */
export const BottomSidebarActions = memo(function BottomSidebarActions({
  collapsed,
  onOpenSettings,
  settingsActive,
}: BottomSidebarActionsProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  if (collapsed) {
    return (
      <div className="mt-auto flex flex-col items-center gap-1 pb-3">
        <NotificationBell />
        <ThemeToggle />
        <div className="relative" ref={dropdownRef}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                className={`flex h-11 w-11 items-center justify-center rounded-md transition-all duration-150 ${
                  settingsActive
                    ? "bg-accent text-accent-foreground before:absolute before:inset-y-1 before:-left-1 before:w-0.5 before:rounded-full before:bg-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Settings
            </TooltipContent>
          </Tooltip>
          {dropdownOpen && (
            <div className="absolute bottom-full left-full mb-1 ml-1 z-50 min-w-44 rounded-md border border-border/80 bg-popover/95 p-1 shadow-lg backdrop-blur">
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-foreground transition hover:bg-muted"
                onClick={() => {
                  onOpenSettings();
                  setDropdownOpen(false);
                }}
              >
                <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                Agent Settings
              </button>
              <div className="my-1 border-t border-border/40" />
              <LogoutButton className="w-full" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border/20 px-2 py-2 shrink-0 flex items-center gap-1">
      <NotificationBell />
      <ThemeToggle />
      <div className="flex-1" />
      <div className="relative" ref={dropdownRef}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className={`flex h-8 items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-all duration-150 ${
                settingsActive || dropdownOpen
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              aria-label="Settings"
              aria-expanded={dropdownOpen}
              aria-haspopup="true"
            >
              <Settings className="h-3.5 w-3.5 shrink-0" />
              <span>Settings</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            Settings
          </TooltipContent>
        </Tooltip>
        {dropdownOpen && (
          <div className="absolute bottom-full left-0 mb-1 z-50 min-w-44 rounded-md border border-border/80 bg-popover/95 p-1 shadow-lg backdrop-blur">
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-foreground transition hover:bg-muted"
              onClick={() => {
                onOpenSettings();
                setDropdownOpen(false);
              }}
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              Agent Settings
            </button>
            <div className="my-1 border-t border-border/40" />
            <LogoutButton className="w-full" />
          </div>
        )}
      </div>
    </div>
  );
});
