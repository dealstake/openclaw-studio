"use client";

import { memo } from "react";
import { Settings, ShieldAlert, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/features/notifications/components/NotificationBell";
import { logout } from "@/lib/cloudflare-auth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useEmergencyOptional } from "@/features/emergency/EmergencyProvider";

type BottomSidebarActionsProps = {
  collapsed: boolean;
  onOpenSettings: () => void;
  settingsActive?: boolean;
};

/**
 * Bottom-left sidebar actions: Notifications, Theme toggle, Settings gear with dropdown.
 * Settings dropdown includes: Agent Settings, Emergency Controls, Sign Out.
 * Uses Radix DropdownMenu (portal-rendered) to escape sidebar overflow:hidden.
 */
export const BottomSidebarActions = memo(function BottomSidebarActions({
  collapsed,
  onOpenSettings,
  settingsActive,
}: BottomSidebarActionsProps) {
  const emergency = useEmergencyOptional();

  const settingsDropdown = (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            {collapsed ? (
              <button
                type="button"
                className={`flex h-11 w-11 items-center justify-center rounded-md transition-all duration-150 ${
                  settingsActive
                    ? "bg-primary/15 text-primary ring-1 ring-primary/25 shadow-sm dark:bg-primary/20"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
                aria-label="Settings"
              >
                <Settings className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                className={`flex h-10 items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-all duration-150 ${
                  settingsActive
                    ? "bg-primary/15 text-primary ring-1 ring-primary/25 shadow-sm dark:bg-primary/20"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                }`}
                aria-label="Settings"
              >
                <Settings className="h-3.5 w-3.5 shrink-0" />
                <span>Settings</span>
              </button>
            )}
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          Settings
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent
        side="right"
        align="end"
        sideOffset={8}
        className="min-w-48"
      >
        <DropdownMenuItem
          onClick={onOpenSettings}
        >
          <Settings className="h-3.5 w-3.5 text-muted-foreground" />
          Agent Settings
        </DropdownMenuItem>

        {emergency && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={emergency.toggle}
              className="text-red-500 focus:text-red-500"
            >
              <ShieldAlert className="h-3.5 w-3.5 !text-red-500" />
              Emergency Controls
            </DropdownMenuItem>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          variant="destructive"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (collapsed) {
    return (
      <div className="mt-auto flex flex-col items-center gap-1 pb-3">
        <NotificationBell />
        <ThemeToggle />
        {settingsDropdown}
      </div>
    );
  }

  return (
    <div className="px-2 py-2 shrink-0 flex items-center gap-1">
      <NotificationBell />
      <ThemeToggle />
      <div className="flex-1" />
      {settingsDropdown}
    </div>
  );
});
