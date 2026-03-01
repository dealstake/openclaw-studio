import { FolderKanban, ListChecks, Brain, FolderOpen, Activity, Puzzle, PieChart, Route, FlaskConical, Network, type LucideIcon } from "lucide-react";

/** Canonical tab configuration — single source of truth for all context panel components. */
export const CONTEXT_TAB_CONFIG = [
  { value: "projects", label: "Projects", shortLabel: "P", Icon: FolderKanban },
  { value: "tasks", label: "Tasks", shortLabel: "T", Icon: ListChecks },
  { value: "brain", label: "Brain", shortLabel: "B", Icon: Brain },
  { value: "workspace", label: "Files", shortLabel: "F", Icon: FolderOpen },
  { value: "skills", label: "Skills", shortLabel: "S", Icon: Puzzle },
  { value: "activity", label: "Activity", shortLabel: "A", Icon: Activity },
  { value: "budget", label: "Budget", shortLabel: "\u20ac", Icon: PieChart },
  { value: "router", label: "Routing", shortLabel: "R", Icon: Route },
  { value: "playground", label: "Playground", shortLabel: "G", Icon: FlaskConical },
  { value: "orchestrator", label: "Swarm", shortLabel: "O", Icon: Network },
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
