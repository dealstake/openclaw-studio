import {
  CheckCircle2,
  ClipboardList,
  Hammer,
  PauseCircle,
  Waves,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Status ──────────────────────────────────────────────────────────────────

export interface StatusConfig {
  label: string;
  icon: LucideIcon;
  colors: string;
}

export const STATUS_ORDER: Record<string, number> = {
  "🔨": 0, // Active
  "📋": 1, // Defined
  "🌊": 2, // Stream
  "⏸️": 3, // Parked
  "✅": 4, // Done
};

export const STATUS_CONFIG: Record<string, StatusConfig> = {
  "🔨": { label: "Active", icon: Hammer, colors: "border-amber-500/30 bg-amber-500/10 text-amber-400" },
  "📋": { label: "Defined", icon: ClipboardList, colors: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
  "🌊": { label: "Stream", icon: Waves, colors: "border-cyan-500/30 bg-cyan-500/10 text-cyan-400" },
  "⏸️": { label: "Parked", icon: PauseCircle, colors: "border-zinc-500/30 bg-zinc-500/10 text-zinc-400" },
  "✅": { label: "Done", icon: CheckCircle2, colors: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
};

// ─── Priority ────────────────────────────────────────────────────────────────

export const PRIORITY_DOT: Record<string, string> = {
  "🔴": "bg-red-400",
  "🟡": "bg-yellow-400",
  "🟢": "bg-green-400",
};

// ─── Status Toggle Mappings ──────────────────────────────────────────────────

export const TOGGLE_MAP: Record<string, { emoji: string; label: string }> = {
  "🔨": { emoji: "⏸️", label: "Parked" },   // Active → Parked
  "📋": { emoji: "🔨", label: "Active" },    // Defined → Active
  "⏸️": { emoji: "🔨", label: "Active" },    // Parked → Active
  "🌊": { emoji: "📋", label: "Defined" },   // Stream → Defined
};
