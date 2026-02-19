import React from "react";
import { Bell } from "lucide-react";
import { HeaderIconButton } from "@/components/HeaderIconButton";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useNotificationStore } from "../hooks/useNotifications";
import { NotificationPanel } from "./NotificationPanel";

export const NotificationBell = React.memo(function NotificationBell() {
  const { unreadCount } = useNotificationStore();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <HeaderIconButton aria-label="Notifications" data-testid="notification-bell">
          <div className="relative">
            <Bell className="h-[15px] w-[15px]" />
            {unreadCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </HeaderIconButton>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] p-0 sm:w-80" align="end">
        <NotificationPanel />
      </PopoverContent>
    </Popover>
  );
});
