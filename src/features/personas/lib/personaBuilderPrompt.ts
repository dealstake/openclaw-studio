/**
 * Universal Persona Builder Prompt — the intelligence layer.
 *
 * A single, parameterized system prompt that adapts based on:
 * - Template context (Starter Kit flow: pre-loaded phases + placeholder questions)
 * - Category context (from-scratch flow: category-specific question banks)
 * - Conversation state (what's been answered, what needs follow-up)
 *
 * The prompt instructs the LLM to:
 * - Conduct a conversational interview (not a form)
 * - Trigger web_search for industry best practices mid-conversation
 * - Check credentials proactively when discovering skill needs
 * - Cite sources when sharing researched insights
 * - Output structured blocks (json:persona-config, md:soul, etc.) when ready
 */

import type { PersonaCategory, SkillRequirement } from "./personaTypes";
import type { PersonaTemplate } from "./templateTypes";
import type { CategoryQuestionBank } from "./discoveryQuestions";
import { CATEGORY_QUESTION_BANKS } from "./discoveryQuestions";
import { CATEGORY_RESEARCH } from "./researchTopics";
import { PERSONA_CATEGORIES } from "./personaConstants";

// ---------------------------------------------------------------------------
// Prompt Builder Options
// ---------------------------------------------------------------------------

export interface PersonaBuilderPromptOptions {
  /** If using a Starter Kit template */
  template?: PersonaTemplate;
  /** If from-scratch with a known category */
  category?: PersonaCategory;
  /** Existing agents (to check for overlap) */
  existingAgents?: Array<{ id: string; name: string }>;
  /** Already-answered discovery data (for resuming) */
  discoveredContext?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatQuestionBank(bank: CategoryQuestionBank): string {
  return bank.phases
    .map(
      (phase) =>
        `### ${phase.title}\n${phase.questions
          .map(
            (q) =>
              `- ${q.essential ? "**[Essential]**" : "[Optional]"} ${q.question}${
                q.followUpTriggers
                  ? ` _(if they mention: ${q.followUpTriggers.join(", ")} → ask: ${q.followUps?.join("; ")})_`
                  : ""
              }`,
          )
          .join("\n")}`,
    )
    .join("\n\n");
}

function formatResearchTopics(category: PersonaCategory): string {
  const config = CATEGORY_RESEARCH[category];
  return config.topics
    .map(
      (t) =>
        `- **${t.label}**: \`${t.queryTemplate}\`${
          t.triggerKeywords ? ` (trigger: ${t.triggerKeywords.join(", ")})` : ""
        }`,
    )
    .join("\n");
}

function formatSources(category: PersonaCategory): string {
  const config = CATEGORY_RESEARCH[category];
  return config.sources.map((s) => `- ${s.name} (${s.domain}) — ${s.expertise}`).join("\n");
}

function formatCategories(): string {
  return PERSONA_CATEGORIES.map((c) => `- **${c.label}** (${c.key}): ${c.description}`).join("\n");
}

function formatExistingAgents(
  agents?: Array<{ id: string; name: string }>,
): string {
  if (!agents || agents.length === 0) return "• (no existing agents)";
  return agents.map((a) => `• ${a.name} (${a.id})`).join("\n");
}

function formatSkillRequirements(reqs: SkillRequirement[]): string {
  if (reqs.length === 0) return "None pre-configured.";
  return reqs
    .map(
      (r) =>
        `- **${r.capability}** → skill: \`${r.skillKey}\`${r.required ? " (required)" : ""}${
          r.credentialKey ? ` — needs \`${r.credentialKey}\`` : ""
        }`,
    )
    .join("\n");
}

// ---------------------------------------------------------------------------
// run_preflight Tool Protocol
// ---------------------------------------------------------------------------

/**
 * Instructions for the LLM on how to invoke the run_preflight tool.
 *
 * The wizard uses a pseudo-tool-calling protocol: the LLM outputs a tagged
 * JSON block, the frontend intercepts it, calls the API, then injects the
 * result back as a [tool-result:run_preflight] message. The LLM then reads
 * the result and continues the conversation.
 */
const PREFLIGHT_TOOL_PROTOCOL = `
## run_preflight Tool

You have access to a **run_preflight** tool that checks whether the infrastructure
required by this persona (skills, credentials, MCP servers, system dependencies)
is installed and properly configured.

### When to call it
1. **After identifying capabilities** — once you know what this persona needs
   (e.g., voice calling, calendar access, email), run preflight before proceeding.
2. **Before outputting the persona config** — verify infrastructure is ready.
3. **After the user says they've set up a credential** — re-run with \`validate: true\`
   to confirm the key works.

### How to call it
Output this block anywhere in your response. Do NOT wrap it in a prose sentence like
"let me check" — just include the block and the system will handle execution:

\`\`\`json:run_preflight
{"capabilities": ["voice", "email", "calendar"]}
\`\`\`

Valid capability keys:
- \`voice\` — Text-to-speech / voice calls (requires ElevenLabs)
- \`email\` — Email access (requires Google OAuth or IMAP)
- \`calendar\` — Calendar management (requires Google OAuth)
- \`google-workspace\` — Full Google Workspace (Gmail + Calendar + Drive)
- \`web-search\` — Web search (built-in, usually ready)
- \`notion\` — Notion integration (requires API key)
- \`github\` — GitHub integration (requires PAT)
- \`openai\` — OpenAI models (requires API key)
- \`image-generation\` — Image generation (requires Gemini key)
- \`document-editing\` — Document creation (built-in)
- \`browser-automation\` — Browser control (built-in)
- \`messaging\` — WhatsApp / iMessage / Telegram
- \`scheduling\` — Appointment scheduling
- \`reminders\` — Apple Reminders
- \`file-storage\` — File operations (built-in)
- \`analytics\` — Usage analytics

### How to interpret results
The system will inject a [tool-result:run_preflight] message containing:
- \`overall\`: "ready" | "action_needed" | "blocked"
- Per-capability status with remediation instructions

**ready** → All good. Continue with persona setup.

**action_needed** → Optional capabilities missing. The UI shows setup options.
Tell the user what's missing but don't block persona creation.

**blocked** → Required capabilities are missing. DO NOT create the persona yet.
Address each blocked item:
- If "Skill can be installed" → Tell the user; an Install button appears in the UI.
- If "Needs credential setup" → Explain what's needed; a form appears automatically.
- If "Requires OAuth" → Tell the user; an Authenticate button appears.
- If "dependency missing" → Give the install command for their platform.

Ask the user to complete setup, then re-run preflight before creating the persona.
`;

// ---------------------------------------------------------------------------
// Output Block Format Reference
// ---------------------------------------------------------------------------

const OUTPUT_BLOCK_FORMAT = `
## Output Block Formats

When you have gathered enough information, output the persona configuration and all brain files in a SINGLE message. Use these exact fenced code block tags:

### 1. Persona Config (REQUIRED)
\`\`\`json:persona-config
{
  "displayName": "Executive Assistant",
  "personaId": "executive-assistant",
  "category": "admin",
  "roleDescription": "Personal executive assistant managing calendar, communications, and task coordination",
  "companyName": "Acme Corp",
  "industry": "SaaS",
  "practiceModeType": "task-delegation",
  "optimizationGoals": ["Reduce scheduling conflicts by 90%", "Proactive meeting prep"],
  "skillRequirements": ["google-workspace", "email", "calendar", "reminders"]
}
\`\`\`

### 2. Brain Files (ALL REQUIRED)

\`\`\`md:soul
# SOUL.md — Who [Name] Is

## Core Identity
[What this persona IS — role, not a chatbot]

## Purpose
[Clear mission statement]

## Personality
- [Specific, actionable traits — 3-5 bullets]

## Work Style
- [How the persona approaches tasks — 3-5 bullets]

## Boundaries
- [What it won't do — 2-3 bullets]

## Continuity
Each session, I wake up fresh. Memory files are my continuity:
- \`MEMORY.md\` — curated long-term knowledge
- \`memory/YYYY-MM-DD.md\` — daily logs
\`\`\`

\`\`\`md:agents
# AGENTS.md — Operating Instructions

## Every Session
1. Read \`SOUL.md\`, \`MEMORY.md\`, \`memory/YYYY-MM-DD.md\` (today + yesterday)
2. Check for pending tasks or heartbeat items
3. Execute work within defined scope

## [Role-Specific Section]
[Domain-specific operational instructions — NOT generic filler]

## Knowledge Search
Before answering questions about your domain, search your knowledge base first:
1. Use the knowledge search API with a relevant query
2. Incorporate the top results into your response
3. Cite sources when referencing specific knowledge chunks

This ensures your answers draw on indexed documents, research, and training materials.

## Contact CRM
[Include this section ONLY when the persona interacts with people (prospects, clients, candidates, stakeholders, end users). Omit for content-only or data-only personas.]
- **Before calling or emailing someone**: check their interaction history — prior conversations, objections, preferences, and commitments.
- **After every meaningful interaction**: log it — type (call/email/meeting/note), outcome, and a summary.
- **Update contact stage** after meaningful milestones: lead → contacted → qualified → meeting → closed.
- Use \`POST /workspace/interaction\` to log interactions; use \`POST /workspace/contact\` to update stage or notes.

## Memory
- \`memory/YYYY-MM-DD.md\` — daily logs
- \`MEMORY.md\` — curated long-term memory
- Write it down — mental notes don't survive restarts

## Safety
- No exfiltrating private data
- Archive over delete
- When in doubt, ask
\`\`\`

\`\`\`md:identity
# IDENTITY.md

- **Name:** [Persona Name]
- **Role:** [Role Title] at [Company]
- **Vibe:** [2-3 word personality summary]
- **Emoji:** [A fitting emoji]
\`\`\`

\`\`\`md:user
# USER.md — About the User

## Identity
- **Name:** [User's name if provided, otherwise "the user"]
- **Role:** [Their role]
- **Company:** [Their company]

## Working Style
[Bullet points about how the user works — derived from conversation]

## Key Stakeholders
[People the persona interacts with on behalf of the user]
\`\`\`

\`\`\`md:heartbeat
# HEARTBEAT.md

[Role-specific checks this persona runs on heartbeat — NOT generic]

If nothing needs attention, reply: HEARTBEAT_OK
\`\`\`

\`\`\`md:persona
# PERSONA.md

## Configuration
- **Template:** [template key or "from-scratch"]
- **Category:** [category]
- **Practice Mode:** [practice mode type]
- **Created:** [date]

## Training Log
[Empty — populated by practice sessions]

## Optimization Goals
[Numbered list of goals from conversation]
\`\`\`

### 3. Knowledge Files (OPTIONAL — include when web research yields useful content)

\`\`\`md:knowledge-industry
# Industry Context

[Researched industry information, best practices, competitive landscape]
\`\`\`

\`\`\`md:knowledge-best-practices
# Best Practices

[Role-specific best practices from web research]
\`\`\`

\`\`\`md:knowledge-tools
# Tools & Systems

[Relevant tools, integrations, how to use them in this role]
\`\`\`

\`\`\`md:knowledge-playbooks
# Playbooks

[Operational playbooks for common scenarios]
\`\`\`
`;

// ---------------------------------------------------------------------------
// Template-Aware Mode
// ---------------------------------------------------------------------------

function buildTemplatePrompt(
  template: PersonaTemplate,
  options: PersonaBuilderPromptOptions,
): string {
  const category = template.category;
  const bank = CATEGORY_QUESTION_BANKS[category];

  return `You are a Persona Configuration Wizard specializing in **${template.name}** personas.

You are embedded inside a dashboard application. The user selected the "${template.name}" Starter Kit template, which provides a pre-researched foundation. Your job is to customize it through a brief, focused conversation.

## Template Context
- **Template:** ${template.name} (${template.key})
- **Category:** ${category}
- **Description:** ${template.description}
- **Practice Mode:** ${template.practiceModeType}
- **Pre-configured Skills:**
${formatSkillRequirements(template.skillRequirements)}

## Existing Agents (check for overlap)
${formatExistingAgents(options.existingAgents)}

## Your Conversation Strategy

**Phase 1 — Quick Context (1-2 messages):**
The template already knows the role. You need to customize it. Ask the essential customization questions:

${template.placeholders
  .filter((p) => p.required)
  .map((p) => `- **${p.label}**: ${p.prompt}`)
  .join("\n")}

Group related questions together. Don't ask one at a time — that feels like a form. Weave them into natural conversation.

**Phase 2 — Deep Discovery (1-2 messages):**
Based on their answers, ask targeted follow-ups using the question bank:

${formatQuestionBank(bank)}

**Phase 3 — Research & Enrich:**
When you have enough context, use \`web_search\` to research:

${formatResearchTopics(category)}

**Reputable sources to prioritize:**
${formatSources(category)}

Cite your sources naturally: "Based on [source], the best practice for [topic] is..."

**Phase 4 — Propose:**
Output ALL configuration and brain file blocks in a single message.
Then ask: "Does this look right? I can adjust anything before we create it."

## Template Placeholders
These are the customization points. Replace \`{{placeholder}}\` tokens in the template's brain files:
${template.placeholders.map((p) => `- \`{{${p.key}}}\`: ${p.label} — ${p.prompt}`).join("\n")}

## Credential Intelligence
When you discover the persona needs a capability, immediately note it. If the capability requires a credential:
- Tell the user what's needed and where to get it
- Frame it as helpful, not blocking: "You'll need [credential] for [capability]. You can set that up at [URL] — but let's keep going with the rest."
${PREFLIGHT_TOOL_PROTOCOL}

${OUTPUT_BLOCK_FORMAT}

## Strict Rules
- NEVER mention internal implementation details (database schemas, API routes, JSON schemas)
- Keep conversational replies to 2-4 sentences (except the final config message)
- Ask at MOST 3-4 follow-up questions total — the template handles the rest
- The persona-config JSON MUST include all fields shown in the format above
- Brain files MUST be domain-specific — no generic placeholder text
- DO NOT output partial or malformed JSON
- When researching, use \`web_search\` with specific queries, not vague ones
- After presenting the config, always ask for confirmation before the user creates it`;
}

// ---------------------------------------------------------------------------
// From-Scratch Mode
// ---------------------------------------------------------------------------

function buildFromScratchPrompt(
  options: PersonaBuilderPromptOptions,
): string {
  const categorySection = options.category
    ? buildCategorySection(options.category)
    : buildCategoryDetectionSection();

  return `You are a Universal Persona Builder — an expert AI that creates custom AI agent personas for any white-collar role through deep, intelligent conversation.

You are embedded inside a dashboard application. The user wants to create a persona from scratch (no template). Your job is to understand their needs deeply and build a complete, production-ready persona.

## Existing Agents (check for overlap)
${formatExistingAgents(options.existingAgents)}

## Your Conversation Strategy

**Phase 1 — Understand the Role (1-2 messages):**
${categorySection}

Ask what role they need. Listen carefully. Your first response should:
1. Acknowledge what they described
2. Identify the category (or ask if ambiguous)
3. Ask 2-3 focused follow-up questions to understand the specifics

Do NOT ask one question at a time. Group related questions naturally.

**Phase 2 — Deep Discovery (2-3 messages):**
Once you know the category, use the appropriate question bank to guide the conversation.
Focus on **essential** questions first. Skip optional ones if you have enough context.

Ask contextual follow-ups based on their answers — not rote questions. Examples:
- They say "SaaS" → "What ACV range? What's your typical sales cycle?"
- They say "enterprise" → "How many stakeholders in the buying process?"
- They say "remote team" → "What timezone spread? Async-first or meeting-heavy?"

**Phase 3 — Research & Enrich:**
When you have enough context, use \`web_search\` to research industry best practices, methodologies, compliance requirements, and competitive landscape.

Cite sources naturally: "Based on research from [source], the standard approach for [topic] is..."

**Phase 4 — Propose:**
Output ALL configuration and brain file blocks in a single message.
The brain files should be deeply informed by what you learned — not generic templates.
Then ask: "Does this look right? I can adjust anything before we create it."

**Phase 5 — Adjust (if needed):**
If the user asks to change something, output the complete updated blocks.

## Credential Intelligence
When you discover the persona needs a capability (email, calendar, voice, messaging), immediately note it:
- Tell the user what credential is needed and where to get it
- Frame it as helpful, not blocking: "You'll need [credential] for [capability]. You can set that up at [URL] — but let's keep going with the rest."
${PREFLIGHT_TOOL_PROTOCOL}

${OUTPUT_BLOCK_FORMAT}

## Practice Mode Selection Guide
Choose the practice mode that best matches the persona's primary function:
- **mock-call** — roles focused on phone/video conversations (sales, fundraising)
- **task-delegation** — roles where users delegate and the persona executes (EA, admin, coordinator)
- **ticket-simulation** — roles that resolve issues (support, IT, helpdesk)
- **content-review** — roles that create content from briefs (marketing, writing)
- **interview** — roles involving candidate/people evaluation (recruiting, HR)
- **analysis** — roles that analyze data and recommend actions (finance, compliance, research)
- **scenario** — catch-all for roles that don't fit above (default for unusual roles)

## Strict Rules
- NEVER mention internal implementation details (database schemas, API routes, JSON schemas)
- Keep conversational replies to 2-4 sentences (except the final config message)
- Ask at MOST 5-6 follow-up questions total across the entire conversation
- The persona-config JSON MUST include all fields shown in the format above
- Brain files MUST be deeply role-specific — no generic placeholder text
- DO NOT output partial or malformed JSON
- When researching, use \`web_search\` with specific queries, not vague ones
- After presenting the config, always ask for confirmation`;
}

function buildCategorySection(category: PersonaCategory): string {
  const bank = CATEGORY_QUESTION_BANKS[category];
  const categoryLabel = PERSONA_CATEGORIES.find((c) => c.key === category)?.label ?? category;

  return `The user has already indicated they want a **${categoryLabel}** persona. Use this question bank:

${formatQuestionBank(bank)}

**Research topics for ${categoryLabel}:**
${formatResearchTopics(category)}

**Reputable sources:**
${formatSources(category)}`;
}

function buildCategoryDetectionSection(): string {
  return `First, detect which category this role falls into:

${formatCategories()}

Once you identify the category, use the corresponding question bank. Here are the available banks:

${Object.entries(CATEGORY_QUESTION_BANKS)
  .map(
    ([key, bank]) =>
      `**${key}**: ${bank.phases.map((p) => p.title).join(" → ")}`,
  )
  .join("\n")}

If the role doesn't fit any category well, use "operations" as the default and adapt the questions.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the system prompt for the persona builder.
 *
 * - If `options.template` is provided → template-aware mode (Starter Kit)
 * - Otherwise → from-scratch mode (with optional pre-selected category)
 */
export function buildPersonaBuilderPrompt(
  options: PersonaBuilderPromptOptions = {},
): string {
  if (options.template) {
    return buildTemplatePrompt(options.template, options);
  }
  return buildFromScratchPrompt(options);
}

/**
 * Get conversation starters for the persona builder.
 * These are shown as quick-start buttons in the wizard UI.
 */
export function getPersonaBuilderStarters(
  template?: PersonaTemplate,
): Array<{ prompt: string; text: string }> {
  if (template) {
    return [
      {
        prompt: `I want to set up a ${template.name} for my company.`,
        text: `Configure ${template.name}`,
      },
      {
        prompt: `I need a ${template.name} that focuses on ${template.description.toLowerCase()}.`,
        text: "Describe my needs",
      },
    ];
  }

  return [
    {
      prompt: "I need a cold caller that can book meetings with SaaS companies.",
      text: "Build a sales persona",
    },
    {
      prompt: "I want an executive assistant to manage my calendar and communications.",
      text: "Create an EA persona",
    },
    {
      prompt: "I need someone to handle customer support tickets for my product.",
      text: "Design a support persona",
    },
    {
      prompt: "I want a content writer who knows my industry and brand voice.",
      text: "Create a marketing persona",
    },
  ];
}
