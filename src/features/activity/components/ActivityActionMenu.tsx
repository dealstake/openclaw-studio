"use client";

import { memo, useState, useCallback } from "react";
import { MoreHorizontal, Play, Square, Copy } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useGateway } from "@/lib/gateway/GatewayProvider";
import { toast } from "sonner";

interface ActivityActionMenuProps {
  /** Task ID for cron re-run */
  taskId?: string;
  /** Task name for display */
  taskName?: string;
  /** Session key for kill / copy */
  sessionKey?: string | null;
  /** Current status */
  status: string;
}

interface ActionItem {
  id: string;
  label: string;
  icon: typeof Play;
  destructive?: boolean;
}

function getActions(props: ActivityActionMenuProps): ActionItem[] {
  const actions: ActionItem[] = [];

  if (props.taskId) {
    actions.push({ id: "rerun", label: "Re-run Job", icon: Play });
  }

  if (props.sessionKey && props.status === "streaming") {
    actions.push({
      id: "kill",
      label: "Kill Session",
      icon: Square,
      destructive: true,
    });
  }

  if (props.sessionKey) {
    actions.push({ id: "copy", label: "Copy Session ID", icon: Copy });
  }

  return actions;
}

export const ActivityActionMenu = memo(function ActivityActionMenu(
  props: ActivityActionMenuProps,
) {
  const { client } = useGateway();
  const [loading, setLoading] = useState(false);
  const [killOpen, setKillOpen] = useState(false);

  const handleAction = useCallback(
    async (actionId: string) => {
      if (actionId === "copy" && props.sessionKey) {
        await navigator.clipboard.writeText(props.sessionKey);
        toast.success("Session ID copied");
        return;
      }

      if (actionId === "kill") {
        setKillOpen(true);
        return;
      }

      if (actionId === "rerun" && props.taskId) {
        setLoading(true);
        try {
          await client.call("cron.update", {
            id: props.taskId,
            patch: { runNow: true },
          });
          toast.success("Job re-run triggered");
        } catch (err) {
          toast.error(
            `Re-run failed: ${err instanceof Error ? err.message : "Unknown error"}`,
          );
        } finally {
          setLoading(false);
        }
      }
    },
    [client, props.taskId, props.sessionKey],
  );

  const handleKillConfirm = useCallback(async () => {
    if (!props.sessionKey) return;
    setLoading(true);
    setKillOpen(false);
    try {
      await client.call("sessions.kill", { key: props.sessionKey });
      toast.success("Session killed");
    } catch (err) {
      toast.error(
        `Kill failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setLoading(false);
    }
  }, [client, props.sessionKey]);

  const actions = getActions(props);
  if (actions.length === 0) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            disabled={loading}
            aria-label={`More actions for ${props.taskName || "activity"}`}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md px-1 py-0.5 text-muted-foreground/40 transition-all hover:text-foreground hover:bg-muted/60 focus-visible:text-foreground focus-visible:opacity-100 md:opacity-0 md:text-muted-foreground md:group-hover/card:opacity-100 md:group-hover/card:text-foreground/80"
          >
            <MoreHorizontal size={14} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          onClick={(e) => e.stopPropagation()}
        >
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <DropdownMenuItem
                key={action.id}
                disabled={loading}
                className={
                  action.destructive ? "text-destructive focus:text-destructive" : ""
                }
                onSelect={() => handleAction(action.id)}
              >
                <Icon size={14} className="mr-2" />
                {action.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={killOpen}
        onOpenChange={setKillOpen}
        title="Kill Session"
        description={`Kill session ${props.taskName ? `"${props.taskName}"` : props.sessionKey ?? ""}? This cannot be undone.`}
        confirmLabel="Kill"
        destructive
        onConfirm={handleKillConfirm}
      />
    </>
  );
});
