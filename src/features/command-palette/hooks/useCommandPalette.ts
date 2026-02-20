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
} from "lucide-react";
import type { ContextTab } from "@/features/context/components/ContextPanel";
import type { CommandAction, CommandPaletteProps } from "../lib/types";

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
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);
  const close = useCallback(() => setOpen(false), []);

  const actions = useMemo<CommandAction[]>(() => {
    const items: CommandAction[] = [];

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
            setOpen(false);
          },
        });
      }
    }

    return items;
  }, [onNavigateTab, onOpenContextPanel, agentIds, currentAgentId, onSwitchAgent]);

  return { open, setOpen, toggle, close, actions };
}
