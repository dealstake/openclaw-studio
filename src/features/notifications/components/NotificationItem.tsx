import React from "react";
import { CheckCircle2, AlertTriangle, DollarSign, Gauge } from "lucide-react";
import type { Notification, AlertRuleType } from "../lib/types";
import { formatRelativeTime } from "@/lib/text/time";

const typeIconMap: Record<AlertRuleType, { icon: React.ElementType; color: string }> = {
  completion: { icon: CheckCircle2, color: "text-emerald-500" },
  error: { icon: AlertTriangle, color: "text-destructive" },
  budget: { icon: DollarSign, color: "text-amber-500" },
  rateLimit: { icon: Gauge, color: "text-blue-500" },
};

type NotificationItemProps = {
  notification: Notification;
  onRead: (id: string) => void;
  onDismiss: (id: string) => void;
};

export const NotificationItem = React.memo(function NotificationItem({
  notification,
  onRead,
  onDismiss,
}: NotificationItemProps) {
  const { icon: Icon, color } = typeIconMap[notification.type];

  return (
    <button
      type="button"
      onClick={() => onRead(notification.id)}
      className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left transition hover:bg-muted/50 ${
        !notification.read ? "border-l-2 border-primary bg-primary/[0.03]" : "border-l-2 border-transparent"
      }`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-xs font-semibold text-foreground">
            {notification.title}
          </span>
          <span className="shrink-0 text-[10px] text-muted-foreground">
            {formatRelativeTime(notification.timestamp)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
          {notification.body}
        </p>
      </div>
      {!notification.read && (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(notification.id);
        }}
        className="mt-0.5 shrink-0 rounded p-0.5 text-muted-foreground/50 transition hover:bg-muted hover:text-foreground"
        aria-label="Dismiss notification"
      >
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M2 2l8 8M10 2l-8 8" />
        </svg>
      </button>
    </button>
  );
});
