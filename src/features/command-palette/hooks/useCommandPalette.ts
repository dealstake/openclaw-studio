"use client";

import { useCallback, useMemo, useState } from "react";
import {
  LayoutGrid,
  ListTodo,
  Brain,
  FolderOpen,
  History,
  BarChart3,
  Radio,
  Clock,
  Settings,
  Bot,
  RotateCcw,
  Play,
  Plus,
  Zap,
} from "lucide-react";
import type { ContextTab } from "@/features/context/components/ContextPanel";
import type { CommandAction, CommandPaletteProps } from "../lib/types";
import { useRecentItems } from "./useRecentItems";

const TAB_COMMANDS: Array<{
  tab: ContextTab;
  label: string;
  icon: typeof LayoutGrid;
  shortcut?: string;
  keywords?: string[];
}> = [
  { tab: "projects", label: "Go to Projects", icon: LayoutGrid, shortcut: "⌘⇧P", keywords: ["project", "board"] },
  { tab: "tasks", label: "Go to Tasks", icon: ListTodo, shortcut: "⌘⇧T", keywords: ["task", "cron", "job"] },
  { tab: "brain", label: "Go to Brain Files", icon: Brain, shortcut: "⌘⇧B", keywords: ["brain", "memory", "soul"] },
  { tab: "workspace", label: "Go to Files", icon: FolderOpen, keywords: ["file", "workspace", "explorer"] },
  { tab: "sessions", label: "Go to Sessions", icon: History, keywords: ["session", "history", "transcript"] },
  { tab: "usage", label: "Go to Usage", icon: BarChart3, keywords: ["usage", "cost", "tokens", "spend"] },
  { tab: "channels", label: "Go to Channels", icon: Radio, keywords: ["channel", "whatsapp", "telegram", "discord"] },
  { tab: "cron", label: "Go to Cron Jobs", icon: Clock, keywords: ["cron", "schedule", "timer"] },
  { tab: "settings", label: "Go to Settings", icon: Settings, keywords: ["settings", "config", "configuration"] },
];

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
    const items: CommandAction[] = [];

    // Recent items (top of list for quick re-access)
    for (const recent of recentItems) {
      // Find matching tab command for icon
      const tabCmd = TAB_COMMANDS.find((c) => `nav-${c.tab}` === recent.id);
      items.push({
        id: `recent-${recent.id}`,
        label: recent.label,
        icon: tabCmd?.icon ?? Zap,
        group: "recent",
        onSelect: () => {
          if (tabCmd) {
            onNavigateTab(tabCmd.tab);
            onOpenContextPanel();
          } else if (recent.id.startsWith("agent-") && onSwitchAgent) {
            onSwitchAgent(recent.id.replace("agent-", ""));
          }
          setOpen(false);
        },
      });
    }

    // Navigation commands
    for (const cmd of TAB_COMMANDS) {
      items.push({
        id: `nav-${cmd.tab}`,
        label: cmd.label,
        icon: cmd.icon,
        group: "navigation",
        keywords: cmd.keywords,
        shortcut: cmd.shortcut,
        onSelect: () => {
          onNavigateTab(cmd.tab);
          onOpenContextPanel();
          trackRecent(`nav-${cmd.tab}`, cmd.label);
          setOpen(false);
        },
      });
    }

    // Action commands
    if (client) {
      items.push({
        id: "action-restart-gateway",
        label: "Restart Gateway",
        icon: RotateCcw,
        group: "actions",
        keywords: ["restart", "gateway", "reconnect", "refresh"],
        onSelect: () => {
          void client.call("gateway.restart", {});
          setOpen(false);
        },
      });

      items.push({
        id: "action-run-cron",
        label: "Run Cron Job…",
        icon: Play,
        group: "actions",
        keywords: ["run", "cron", "trigger", "execute", "job"],
        onSelect: () => {
          onNavigateTab("cron");
          onOpenContextPanel();
          trackRecent("nav-cron", "Go to Cron Jobs");
          setOpen(false);
        },
      });
    }

    if (onCreateProject) {
      items.push({
        id: "action-create-project",
        label: "Create Project",
        icon: Plus,
        group: "actions",
        keywords: ["new", "project", "create", "add"],
        onSelect: () => {
          onCreateProject();
          setOpen(false);
        },
      });

      items.push({
        id: "action-continue-project",
        label: "Continue Project…",
        icon: Play,
        group: "actions",
        keywords: ["continue", "project", "resume", "progress"],
        onSelect: () => {
          onNavigateTab("projects");
          onOpenContextPanel();
          trackRecent("nav-projects", "Go to Projects");
          setOpen(false);
        },
      });
    }

    // Agent switching commands
    if (agentIds && onSwitchAgent) {
      for (const id of agentIds) {
        if (id === currentAgentId) continue;
        items.push({
          id: `agent-${id}`,
          label: `Switch to ${id}`,
          icon: Bot,
          group: "agents",
          keywords: ["agent", "switch", id],
          onSelect: () => {
            onSwitchAgent(id);
            trackRecent(`agent-${id}`, `Switch to ${id}`);
            setOpen(false);
          },
        });
      }
    }

    return items;
  }, [onNavigateTab, onOpenContextPanel, agentIds, currentAgentId, onSwitchAgent, client, onCreateProject, recentItems, trackRecent]);

  return { open, setOpen, toggle, close, actions };
}
