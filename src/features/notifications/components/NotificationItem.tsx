import React from "react";
import { CheckCircle2, AlertTriangle, DollarSign, Gauge, X, TrendingUp } from "lucide-react";
import type { Notification, AlertRuleType } from "../lib/types";
import { formatRelativeTime } from "@/lib/text/time";
import { BaseCard, CardHeader } from "@/components/ui/BaseCard";

const typeIconMap: Record<AlertRuleType, { icon: React.ElementType; color: string }> = {
  completion: { icon: CheckCircle2, color: "text-emerald-500" },
  error: { icon: AlertTriangle, color: "text-destructive" },
  budget: { icon: DollarSign, color: "text-amber-500" },
  rateLimit: { icon: Gauge, color: "text-blue-500" },
  anomaly: { icon: TrendingUp, color: "text-orange-600 dark:text-orange-500" },
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
    <BaseCard
      variant="flush"
      isHoverable
      className={`cursor-pointer ${
        !notification.read ? "border-l-2 border-l-primary bg-primary/[0.03]" : ""
      }`}
      onClick={() => onRead(notification.id)}
      role="button"
    >
      <CardHeader className="items-start gap-2.5">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-xs font-semibold text-foreground transition-colors duration-150 group-hover/card:text-primary">
              {notification.title}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
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
          className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-md text-muted-foreground/50 transition hover:bg-muted hover:text-foreground"
          aria-label="Dismiss notification"
        >
          <X className="h-3 w-3" />
        </button>
      </CardHeader>
    </BaseCard>
  );
});
