/**
 * Reusable brain file formatting utilities for agent creation.
 * Used by both the agent wizard and persona builder.
 */

import type { PersonaConfig, ToolProfile } from "@/features/personas/lib/personaTypes";

// ---------------------------------------------------------------------------
// Generic Templates (fallbacks when AI doesn't generate custom content)
// ---------------------------------------------------------------------------

/**
 * Generate a minimal SOUL.md for a persona agent.
 */
export function generatePersonaSoulMd(config: PersonaConfig): string {
  return `# SOUL.md — ${config.displayName}

## Core Identity
I am **${config.displayName}**, a ${config.roleDescription}.${
    config.companyName ? ` I work for ${config.companyName}.` : ""
  }${config.industry ? ` My industry is ${config.industry}.` : ""}

## Personality
- Professional and competent
- Proactive — anticipate needs rather than waiting to be asked
- Clear communicator — adapt tone to the audience
- Results-oriented — always driving toward measurable outcomes

## Continuity
Each session, I wake up fresh. Memory files are my continuity:
- \`MEMORY.md\` — curated long-term knowledge
- \`memory/YYYY-MM-DD.md\` — daily logs
`;
}

/**
 * Generate a minimal AGENTS.md for a persona agent.
 *
 * Includes a Knowledge Search section that instructs the persona to query
 * its indexed knowledge base (FTS5) before answering domain questions.
 * This is the default fallback template — the AI wizard generates richer
 * role-specific instructions when creating personas via conversation.
 */
export function generatePersonaAgentsMd(config: PersonaConfig): string {
  const domainContext = config.roleDescription
    ? `questions about ${config.roleDescription.toLowerCase()}`
    : "domain-specific questions";

  return `# AGENTS.md — ${config.displayName}

## Every Session
1. Read \`SOUL.md\`, \`USER.md\`, \`IDENTITY.md\`
2. Read \`PERSONA.md\` for structured configuration
3. Read \`memory/\` for recent context
4. Check \`knowledge/\` for role-specific reference material

## 🔍 Knowledge Search (NON-NEGOTIABLE)
Before answering ${domainContext}, search the indexed knowledge base first:
1. Call the knowledge search API: \`GET /api/workspace/knowledge/search?personaId=<id>&q=<query>\`
2. Incorporate the top results into your response
3. Cite sources when referencing specific knowledge chunks

This ensures answers draw on indexed documents, research, and training materials
rather than relying solely on general knowledge.

## Safety
- No exfiltrating private data
- Ask before acting externally (emails, posts, public actions)
- Archive over delete
`;
}

/**
 * Generate IDENTITY.md for a persona agent.
 */
export function generatePersonaIdentityMd(config: PersonaConfig): string {
  return `# IDENTITY.md

- **Name:** ${config.displayName}
- **Role:** ${config.roleDescription}${
    config.companyName ? `\n- **Company:** ${config.companyName}` : ""
  }${config.industry ? `\n- **Industry:** ${config.industry}` : ""}
- **Category:** ${config.category}
`;
}

/**
 * Generate a minimal USER.md (placeholder — customized during wizard).
 */
export function generatePersonaUserMd(): string {
  return `# USER.md — About My User

## Identity
- **Name:** (set during customization)
- **Role:** (set during customization)

## Working Style
- Customize this file during the persona setup conversation
`;
}

/**
 * Generate PERSONA.md with structured YAML frontmatter.
 */
export function generatePersonaMd(config: PersonaConfig): string {
  const goals = config.optimizationGoals.length > 0
    ? config.optimizationGoals.map((g) => `  - ${g}`).join("\n")
    : "  - (none set)";

  const skills = config.skillRequirements.length > 0
    ? config.skillRequirements
        .map((s) => `  - ${s.capability} (${s.skillKey})${s.required ? " [required]" : ""}`)
        .join("\n")
    : "  - (none)";

  return `# PERSONA.md — ${config.displayName}

## Configuration
- **Persona ID:** ${config.personaId}
- **Template:** ${config.templateKey ?? "from-scratch"}
- **Category:** ${config.category}
- **Practice Mode:** ${config.practiceModeType}
- **Tool Profile:** ${config.toolProfile ?? "minimal"}
- **Status:** ${config.status}

## Optimization Goals
${goals}

## Skill Requirements
${skills}

## Training Log
_No practice sessions yet._
`;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Tool Profile → TOOLS.md
// ---------------------------------------------------------------------------

const TOOL_PROFILE_CONTENT: Record<ToolProfile, string> = {
  full: `# TOOLS.md — Tool Access

## Available Tools
All tools are available. Use whatever tools are needed to accomplish the task.
`,
  research: `# TOOLS.md — Tool Access (Research Profile)

## Available Tools
- **web_search** — Search the web for information
- **web_fetch** — Fetch and extract content from URLs
- **read** — Read file contents from the workspace
- **memory_search** / **memory_get** — Search and read memory files

## Restricted
Other tools (exec, write, edit, message, browser, etc.) are NOT available for this role.
Focus on research, analysis, and information gathering.
`,
  development: `# TOOLS.md — Tool Access (Development Profile)

## Available Tools
- **exec** — Run shell commands
- **read** — Read file contents
- **write** — Create or overwrite files
- **edit** — Make precise edits to files
- **browser** — Control web browser for testing
- **web_search** / **web_fetch** — Search and fetch web content
- **memory_search** / **memory_get** — Search and read memory files

## Restricted
Messaging tools (message, tts) are NOT available for this role.
Focus on code, file operations, and technical tasks.
`,
  communication: `# TOOLS.md — Tool Access (Communication Profile)

## Available Tools
- **message** — Send messages via configured channels
- **tts** — Convert text to speech
- **web_search** / **web_fetch** — Search and fetch web content for context
- **read** — Read file contents from the workspace
- **memory_search** / **memory_get** — Search and read memory files

## Restricted
Code execution tools (exec, write, edit, browser) are NOT available for this role.
Focus on outbound communication and messaging.
`,
  minimal: `# TOOLS.md — Tool Access (Minimal Profile)

## Available Tools
- **memory_search** / **memory_get** — Search and read memory files

## Note
This role operates in pure conversation mode. No external tools are available.
Focus on coaching, practice, and conversational skill-building.
`,
};

/**
 * Generate TOOLS.md based on the persona's tool profile.
 */
export function generatePersonaToolsMd(config: PersonaConfig): string {
  const profile = config.toolProfile ?? "minimal";
  return TOOL_PROFILE_CONTENT[profile];
}

// Full Brain File Set
// ---------------------------------------------------------------------------

/**
 * Generate a complete set of default brain files for a persona.
 * These serve as fallbacks — the AI-generated versions from the wizard
 * are preferred when available.
 */
export function generateDefaultBrainFiles(
  config: PersonaConfig,
): Record<string, string> {
  return {
    "SOUL.md": generatePersonaSoulMd(config),
    "AGENTS.md": generatePersonaAgentsMd(config),
    "IDENTITY.md": generatePersonaIdentityMd(config),
    "USER.md": generatePersonaUserMd(),
    "TOOLS.md": generatePersonaToolsMd(config),
    "PERSONA.md": generatePersonaMd(config),
    "MEMORY.md": `# MEMORY.md — ${config.displayName}\n\n_Created ${new Date().toISOString().split("T")[0]}. No memories yet._\n`,
  };
}
