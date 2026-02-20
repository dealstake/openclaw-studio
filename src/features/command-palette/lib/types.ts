import type { LucideIcon } from "lucide-react";
import type { ContextTab } from "@/features/context/components/ContextPanel";

export interface CommandAction {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon component */
  icon?: LucideIcon;
  /** Group this action belongs to */
  group: "navigation" | "actions" | "agents";
  /** Keywords for fuzzy search (beyond the label) */
  keywords?: string[];
  /** Keyboard shortcut hint (display only) */
  shortcut?: string;
  /** Handler when selected */
  onSelect: () => void;
}

export interface CommandPaletteProps {
  /** Navigate to a context panel tab */
  onNavigateTab: (tab: ContextTab) => void;
  /** Open context panel if closed */
  onOpenContextPanel: () => void;
  /** Available agent IDs for switching */
  agentIds?: string[];
  /** Current agent ID */
  currentAgentId?: string;
  /** Switch to a different agent */
  onSwitchAgent?: (agentId: string) => void;
}
