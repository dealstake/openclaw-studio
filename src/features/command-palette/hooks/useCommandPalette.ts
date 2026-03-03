"use client";

import { useCallback, useMemo, useState } from "react";
import {
  LayoutGrid,
  ListTodo,
  FolderOpen,
  BarChart3,
  Radio,

  Settings,
  Bot,
  RotateCcw,
  Play,
  Plus,
  Zap,
  Route,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CommandAction, CommandPaletteProps, NavTab, RecentItemType } from "../lib/types";
import { useRecentItems } from "./useRecentItems";

const TAB_COMMANDS: Array<{
  tab: NavTab;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  keywords?: string[];
}> = [
  { tab: "projects", label: "Go to Projects", icon: LayoutGrid, shortcut: "⌘⇧P", keywords: ["project", "board"] },
  { tab: "tasks", label: "Go to Tasks", icon: ListTodo, shortcut: "⌘⇧T", keywords: ["task", "cron", "job"] },
  { tab: "workspace", label: "Go to Files", icon: FolderOpen, keywords: ["file", "workspace", "explorer"] },
  { tab: "usage", label: "Go to Usage", icon: BarChart3, keywords: ["usage", "cost", "tokens", "spend"] },
  { tab: "channels", label: "Go to Channels", icon: Radio, keywords: ["channel", "whatsapp", "telegram", "discord"] },
  { tab: "router", label: "Go to Model Router", icon: Route, shortcut: "⌘⇧R", keywords: ["router", "routing", "model", "route", "cost"] },
  { tab: "personas", label: "Go to Personas", icon: Settings, keywords: ["settings", "config", "configuration", "personas", "agents"] },
];

// --- Pure action builder functions (extracted from monolithic useMemo) ---

interface ActionContext {
  onNavigateTab: (tab: NavTab) => void;
  onOpenContextPanel: () => void;
  trackRecent: (id: string, label: string, type?: RecentItemType) => void;
  close: () => void;
}

function navigateAndClose(ctx: ActionContext, tab: NavTab, label: string): void {
  ctx.onNavigateTab(tab);
  ctx.trackRecent(`nav-${tab}`, label, "navigation");
  ctx.close();
}

function createRecentActions(
  recentItems: Array<{ id: string; label: string; type?: string }>,
  ctx: ActionContext,
  onSwitchAgent?: (agentId: string) => void,
): CommandAction[] {
  return recentItems.map((recent) => {
    const tabCmd = TAB_COMMANDS.find((c) => `nav-${c.tab}` === recent.id);
    return {
      id: `recent-${recent.id}`,
      label: recent.label,
      icon: tabCmd?.icon ?? Zap,
      group: "recent" as const,
      onSelect: () => {
        if (recent.type === "navigation" && tabCmd) {
          ctx.onNavigateTab(tabCmd.tab);
        } else if (recent.type === "agent" && onSwitchAgent) {
          onSwitchAgent(recent.id.replace("agent-", ""));
        }
        ctx.trackRecent(recent.id, recent.label, (recent.type as RecentItemType) ?? "action");
        ctx.close();
      },
    };
  });
}

function createNavigationActions(ctx: ActionContext): CommandAction[] {
  return TAB_COMMANDS.map((cmd) => ({
    id: `nav-${cmd.tab}`,
    label: cmd.label,
    icon: cmd.icon,
    group: "navigation" as const,
    keywords: cmd.keywords,
    shortcut: cmd.shortcut,
    onSelect: () => navigateAndClose(ctx, cmd.tab, cmd.label),
  }));
}

function createGatewayActions(
  client: NonNullable<CommandPaletteProps["client"]>,
  ctx: ActionContext,
): CommandAction[] {
  return [
    {
      id: "action-restart-gateway",
      label: "Restart Gateway",
      icon: RotateCcw,
      group: "actions" as const,
      keywords: ["restart", "gateway", "reconnect", "refresh"],
      onSelect: () => {
        void client.call("gateway.restart", {}).catch(() => {
          /* network error — gateway is restarting, ignore */
        });
        ctx.close();
      },
    },
    {
      id: "action-run-task",
      label: "Run Task…",
      icon: Play,
      group: "actions" as const,
      keywords: ["run", "cron", "trigger", "execute", "job", "task"],
      onSelect: () => navigateAndClose(ctx, "tasks", "Go to Tasks"),
    },
  ];
}

function createProjectActions(
  onCreateProject: () => void,
  ctx: ActionContext,
): CommandAction[] {
  return [
    {
      id: "action-create-project",
      label: "Create Project",
      icon: Plus,
      group: "actions" as const,
      keywords: ["new", "project", "create", "add"],
      onSelect: () => {
        onCreateProject();
        ctx.close();
      },
    },
    {
      id: "action-continue-project",
      label: "Continue Project…",
      icon: Play,
      group: "actions" as const,
      keywords: ["continue", "project", "resume", "progress"],
      onSelect: () => navigateAndClose(ctx, "projects", "Go to Projects"),
    },
  ];
}

function createAgentActions(
  agentIds: string[],
  currentAgentId: string | undefined,
  onSwitchAgent: (agentId: string) => void,
  ctx: ActionContext,
): CommandAction[] {
  return agentIds
    .filter((id) => id !== currentAgentId)
    .map((id) => ({
      id: `agent-${id}`,
      label: `Switch to ${id}`,
      icon: Bot,
      group: "agents" as const,
      keywords: ["agent", "switch", id],
      onSelect: () => {
        onSwitchAgent(id);
        ctx.trackRecent(`agent-${id}`, `Switch to ${id}`, "agent");
        ctx.close();
      },
    }));
}

// --- Hook ---

export function useCommandPalette({
  onNavigateTab,
  onOpenContextPanel,
  agentIds,
  currentAgentId,
  onSwitchAgent,
  client,
  onCreateProject,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const { recentItems, trackRecent } = useRecentItems();

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);

  const actions = useMemo<CommandAction[]>(() => {
    const ctx: ActionContext = { onNavigateTab, onOpenContextPanel, trackRecent, close };
    return [
      ...createRecentActions(recentItems, ctx, onSwitchAgent),
      ...createNavigationActions(ctx),
      ...(client ? createGatewayActions(client, ctx) : []),
      ...(onCreateProject ? createProjectActions(onCreateProject, ctx) : []),
      ...(agentIds && onSwitchAgent ? createAgentActions(agentIds, currentAgentId, onSwitchAgent, ctx) : []),
    ];
  }, [onNavigateTab, onOpenContextPanel, agentIds, currentAgentId, onSwitchAgent, client, onCreateProject, recentItems, trackRecent, close]);

  return { open, setOpen, toggle, close, actions };
}
