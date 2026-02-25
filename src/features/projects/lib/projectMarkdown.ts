import type { ProjectConfig } from "../components/ProjectPreviewCard";

/**
 * Convert a project name to a URL-friendly slug.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/**
 * Generate the markdown content for a new project file.
 */
export function generateMarkdown(config: ProjectConfig): string {
  const now = new Date().toISOString().slice(0, 10);

  const phaseSections = config.phases
    .map(
      (phase) =>
        `### ${phase.name}\n${phase.tasks.map((t) => `- [ ] ${t}`).join("\n")}`,
    )
    .join("\n\n");

  return `# ${config.name}

> ${config.description}

## Status: 📋 Defined
## Priority: ${config.priority}

## Problem

_Describe the problem this project solves._

## Research Findings

_To be filled during research phase._

## Implementation Plan

${phaseSections}

## Key Decisions

_Document technical choices and rationale here._

## Continuation Context
_Updated by the agent at end of each work session_
- **Last worked on**: ${now} — Project created via AI wizard
- **Immediate next step**: Define implementation plan details and begin Phase 1
- **Blocked by**: Nothing
- **Context needed**: TBD

## History
- ${now}: Project created via Studio AI wizard.
`;
}
