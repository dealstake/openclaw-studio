import type { LucideIcon } from "lucide-react";
import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type { ContextTab } from "@/features/context/components/ContextPanel";

/** All navigable tabs — context panel tabs + management tabs (opened in expanded modal) */
export type NavTab = ContextTab | "sessions" | "usage" | "channels" | "settings";

export interface CommandAction {
  /** Unique identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon component */
  icon?: LucideIcon;
  /** Group this action belongs to */
  group: "navigation" | "actions" | "agents" | "recent";
  /** Keywords for fuzzy search (beyond the label) */
  keywords?: string[];
  /** Keyboard shortcut hint (display only) */
  shortcut?: string;
  /** Handler when selected */
  onSelect: () => void;
}

export interface RecentItem {
  /** Unique key (e.g., "nav-projects", "agent-alex") */
  id: string;
  /** Display label */
  label: string;
  /** Timestamp of last access */
  accessedAt: number;
}

export interface CommandPaletteProps {
  /** Navigate to a context panel tab */
  onNavigateTab: (tab: NavTab) => void;
  /** Open context panel if closed */
  onOpenContextPanel: () => void;
  /** Available agent IDs for switching */
  agentIds?: string[];
  /** Current agent ID */
  currentAgentId?: string;
  /** Switch to a different agent */
  onSwitchAgent?: (agentId: string) => void;
  /** Gateway client for action commands */
  client?: GatewayClient | null;
  /** Callback when project creation is requested */
  onCreateProject?: () => void;
}
