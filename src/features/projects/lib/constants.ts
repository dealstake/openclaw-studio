import {
  CheckCircle2,
  ClipboardList,
  FlaskConical,
  FolderGit2,
  Hammer,
  Loader2,
  PauseCircle,
  Inbox,
  ListOrdered,
  Server,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Status ──────────────────────────────────────────────────────────────────

export interface StatusConfig {
  label: string;
  icon: LucideIcon;
  colors: string;
}

export const STATUS_ORDER: Record<string, number> = {
  "🚧": 0, // Building (always first)
  "🔨": 1, // Active
  "📋": 2, // Defined
  "🌊": 3, // Backlog (renamed from Stream)
  "⏸️": 4, // Parked
  "✅": 5, // Done
};

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  "🚧": { label: "Building", icon: Loader2, colors: "border-purple-500/30 bg-purple-500/10 text-purple-300" },
  "🔨": { label: "Active", icon: Hammer, colors: "border-amber-500/30 bg-amber-500/15 text-amber-200" },
  "📋": { label: "Defined", icon: ClipboardList, colors: "border-blue-500/30 bg-blue-500/10 text-blue-300" },
  "🌊": { label: "Backlog", icon: Inbox, colors: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300" },
  "⏸️": { label: "Parked", icon: PauseCircle, colors: "border-zinc-500/30 bg-zinc-500/10 text-zinc-300" },
  "✅": { label: "Done", icon: CheckCircle2, colors: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" },
};

/** All status keys for filter UI (in display order) */
export const STATUS_KEYS = Object.keys(STATUS_ORDER).sort(
  (a, b) => (STATUS_ORDER[a] ?? 99) - (STATUS_ORDER[b] ?? 99)
);

/**
 * Statuses available in the clickable status-cycle dropdown.
 * Order = display order in the popover.
 */
export const CYCLE_STATUSES: Array<{ emoji: string; label: string }> = [
  { emoji: "🚧", label: "Building" },
  { emoji: "🔨", label: "Active" },
  { emoji: "📋", label: "Defined" },
  { emoji: "🌊", label: "Backlog" },
  { emoji: "⏸️", label: "Parked" },
  { emoji: "✅", label: "Done" },
];

// ─── Queued Status (virtual — rendered for cards queued behind Building) ────

export const QUEUED_CONFIG: StatusConfig = {
  label: "Queued",
  icon: ListOrdered,
  colors: "border-orange-500/30 bg-orange-500/10 text-orange-300",
};

// ─── Priority ────────────────────────────────────────────────────────────────

export const PRIORITY_ORDER: Record<string, number> = {
  "🔴": 0, // P0
  "🟡": 1, // P1
  "🟢": 2, // P2
  "⚪": 3, // P3
};

export const PRIORITY_DOT: Record<string, string> = {
  "🔴": "bg-red-400",
  "🟡": "bg-yellow-400",
  "🟢": "bg-green-400",
};

// ─── Priority Colors (full-label keyed — for preview cards and badges) ───────

export const PRIORITY_COLORS: Record<string, string> = {
  "🔴 P0": "bg-red-500/20 text-red-300",
  "🟡 P1": "bg-yellow-500/20 text-yellow-300",
  "🟢 P2": "bg-green-500/20 text-green-300",
};

/** Full-label priority dot colors (for preview cards) */
export const PRIORITY_DOT_FULL: Record<string, string> = {
  "🔴 P0": "bg-red-500",
  "🟡 P1": "bg-yellow-500",
  "🟢 P2": "bg-green-500",
};

// ─── Type Cards (for project wizard type selection) ──────────────────────────

export type ProjectType = "feature" | "infrastructure" | "research" | "other";

export const TYPE_CARDS: Array<{
  type: ProjectType;
  icon: typeof Sparkles;
  title: string;
  desc: string;
  color: string;
}> = [
  {
    type: "feature",
    icon: Sparkles,
    title: "New Feature",
    desc: "Build a new user-facing capability or component.",
    color: "border-green-500/40 hover:border-green-500/70 hover:bg-green-500/5",
  },
  {
    type: "infrastructure",
    icon: Server,
    title: "Infrastructure",
    desc: "Update cloud resources, CI/CD, or deployment logic.",
    color: "border-purple-500/40 hover:border-purple-500/70 hover:bg-purple-500/5",
  },
  {
    type: "research",
    icon: FlaskConical,
    title: "Research Spike",
    desc: "Explore a new technology, API, or design pattern.",
    color: "border-orange-500/40 hover:border-orange-500/70 hover:bg-orange-500/5",
  },
  {
    type: "other",
    icon: FolderGit2,
    title: "Other",
    desc: "Something else — define the scope yourself.",
    color: "border-zinc-500/40 hover:border-zinc-500/70 hover:bg-zinc-500/5",
  },
];

// ─── Sort ────────────────────────────────────────────────────────────────────

/**
 * Sort projects deterministically:
 * 1. Status rank (Building → Active → Defined → Backlog → Parked → Done)
 * 2. Priority rank within same status (P0 → P1 → P2 → P3)
 * 3. Name alphabetically as tiebreaker
 */
export function sortProjects<
  T extends { statusEmoji: string; priorityEmoji: string; name: string },
>(projects: T[]): T[] {
  return [...projects].sort((a, b) => {
    const statusA = STATUS_ORDER[a.statusEmoji] ?? 99;
    const statusB = STATUS_ORDER[b.statusEmoji] ?? 99;
    if (statusA !== statusB) return statusA - statusB;

    const prioA = PRIORITY_ORDER[a.priorityEmoji] ?? 99;
    const prioB = PRIORITY_ORDER[b.priorityEmoji] ?? 99;
    if (prioA !== prioB) return prioA - prioB;

    return a.name.localeCompare(b.name);
  });
}

// ─── Status Toggle Mappings (legacy — kept for backward compat) ──────────────

export const TOGGLE_MAP: Record<string, { emoji: string; label: string }> = {
  "🔨": { emoji: "⏸️", label: "Parked" },   // Active → Parked
  "📋": { emoji: "🔨", label: "Active" },    // Defined → Active
  "⏸️": { emoji: "🔨", label: "Active" },    // Parked → Active
  "🌊": { emoji: "📋", label: "Defined" },   // Backlog → Defined
};
