import type { AgentFileName } from "@/lib/agents/agentFiles";

/** Known brain file section with guidance */
export interface SectionHint {
  /** Heading text to match (case-insensitive) */
  heading: string;
  /** Short description shown in tooltip */
  description: string;
}

const SOUL_HINTS: SectionHint[] = [
  { heading: "Core Identity", description: "Who your agent is — name, role, personality in 1-2 sentences" },
  { heading: "Personality", description: "Communication style — direct, formal, casual, etc." },
  { heading: "Work Style", description: "How your agent approaches tasks — proactive, cautious, etc." },
  { heading: "Boundaries", description: "What your agent should never do" },
  { heading: "Continuity", description: "How your agent maintains memory across sessions" },
];

const AGENTS_HINTS: SectionHint[] = [
  { heading: "Every Session", description: "Steps your agent runs at the start of each session" },
  { heading: "Coding Standards", description: "Rules for code quality, style, and testing" },
  { heading: "Projects", description: "How your agent manages multi-session work" },
  { heading: "Memory", description: "Rules for what gets remembered and how" },
  { heading: "Safety", description: "Data handling, deletion policies, confirmation requirements" },
];

const MEMORY_HINTS: SectionHint[] = [
  { heading: "Credentials", description: "Stored credentials and access patterns" },
  { heading: "Key Lessons", description: "Important lessons learned from past mistakes" },
  { heading: "Deployment", description: "Deployment rules and environments" },
  { heading: "Active TODOs", description: "Current work items and their status" },
];

/** Map file name to its section hints */
export const HINTS_BY_FILE: Partial<Record<AgentFileName, SectionHint[]>> = {
  "SOUL.md": SOUL_HINTS,
  "AGENTS.md": AGENTS_HINTS,
  "MEMORY.md": MEMORY_HINTS,
};
