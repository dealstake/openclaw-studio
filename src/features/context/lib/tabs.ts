import { FolderKanban, ListChecks, FolderOpen, Sparkles, Puzzle, PieChart, Route, FlaskConical, Network, Share2, MessageSquarePlus, type LucideIcon } from "lucide-react";

/** Canonical tab configuration — single source of truth for all context panel components. */
export const CONTEXT_TAB_CONFIG = [
  { value: "projects", label: "Projects", shortLabel: "Projects", Icon: FolderKanban },
  { value: "tasks", label: "Tasks", shortLabel: "Tasks", Icon: ListChecks },
  { value: "workspace", label: "Files", shortLabel: "Files", Icon: FolderOpen },
  { value: "skills", label: "Skills", shortLabel: "Skills", Icon: Puzzle },
  { value: "activity", label: "Activity", shortLabel: "Activity", Icon: Sparkles },
  { value: "budget", label: "Budget", shortLabel: "Budget", Icon: PieChart },
  { value: "router", label: "Routing", shortLabel: "Routing", Icon: Route },
  { value: "playground", label: "Playground", shortLabel: "Play", Icon: FlaskConical },
  { value: "orchestrator", label: "Swarm", shortLabel: "Swarm", Icon: Network },
  { value: "memory-graph", label: "Memory", shortLabel: "Memory", Icon: Share2 },
  { value: "feedback", label: "Feedback", shortLabel: "Feedback", Icon: MessageSquarePlus },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  shortLabel: string;
  Icon: LucideIcon;
}>;

/** Derived union type from config. */
export type ContextTab = (typeof CONTEXT_TAB_CONFIG)[number]["value"];

/** Panel ID for ARIA linkage: `context-tabpanel-{tab}` */
export function tabPanelId(tab: ContextTab): string {
  return `context-tabpanel-${tab}`;
}

/** Tab button ID for ARIA linkage: `context-tab-{tab}` */
export function tabButtonId(tab: ContextTab): string {
  return `context-tab-${tab}`;
}
