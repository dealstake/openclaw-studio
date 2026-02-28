/**
 * Theme constants per wizard type.
 *
 * Each wizard gets a distinct accent color so users can visually
 * distinguish which wizard mode is active in the main chat.
 */

import type { WizardTheme, WizardType, WizardStarter } from "./wizardTypes";

// ── Theme Definitions ──────────────────────────────────────────────────

export const WIZARD_THEMES: Record<WizardType, WizardTheme> = {
  task: {
    accent: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/60",
    label: "Task Wizard",
    icon: "CalendarClock",
  },
  agent: {
    accent: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/60",
    label: "Agent Wizard",
    icon: "Bot",
  },
  project: {
    accent: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/60",
    label: "Project Wizard",
    icon: "FolderKanban",
  },
  skill: {
    accent: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/60",
    label: "Skill Wizard",
    icon: "Puzzle",
  },
  credential: {
    accent: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/60",
    label: "Credential Wizard",
    icon: "KeyRound",
  },
};

// ── Default Starters ───────────────────────────────────────────────────

export const WIZARD_STARTERS: Record<WizardType, WizardStarter[]> = {
  task: [
    { label: "Schedule a daily check", message: "I want to schedule a daily task that runs every morning" },
    { label: "Monitor something", message: "I need to monitor a website for changes" },
    { label: "Recurring report", message: "Create a weekly summary report" },
  ],
  agent: [
    { label: "Create a coding agent", message: "I want to create a new agent for coding tasks" },
    { label: "Create a research agent", message: "I need an agent that can research topics" },
    { label: "Create a monitoring agent", message: "Set up an agent to watch my infrastructure" },
  ],
  project: [
    { label: "New feature", message: "I want to plan a new feature" },
    { label: "Bug fix project", message: "I need to track a complex bug fix" },
    { label: "Refactor", message: "Plan a codebase refactor" },
  ],
  skill: [
    { label: "CLI integration", message: "I want to create a skill for a CLI tool" },
    { label: "API wrapper", message: "Create a skill that wraps an API" },
    { label: "Automation skill", message: "Build a skill for automating a workflow" },
  ],
  credential: [
    { label: "API key", message: "I need to add an API key" },
    { label: "OAuth setup", message: "Set up OAuth credentials" },
    { label: "Service account", message: "Configure a service account" },
  ],
};

/**
 * Get the theme for a wizard type.
 */
export function getWizardTheme(type: WizardType): WizardTheme {
  return WIZARD_THEMES[type];
}

/**
 * Get default conversation starters for a wizard type.
 */
export function getWizardStarters(type: WizardType): WizardStarter[] {
  return WIZARD_STARTERS[type];
}
