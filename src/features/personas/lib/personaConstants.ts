/**
 * Constants for the persona system — labels, defaults, category metadata.
 */

import type { PersonaCategory, PracticeModeType, ScoringDimension } from "./personaTypes";
import type { TemplateCategory } from "./templateTypes";

// ---------------------------------------------------------------------------
// Category Metadata
// ---------------------------------------------------------------------------

export const PERSONA_CATEGORIES: TemplateCategory[] = [
  { key: "sales", label: "Sales", description: "Revenue generation and pipeline management", icon: "PhoneCall" },
  { key: "admin", label: "Administration", description: "Executive support and office management", icon: "ClipboardList" },
  { key: "support", label: "Support", description: "Customer service and technical help", icon: "Headphones" },
  { key: "marketing", label: "Marketing", description: "Content, campaigns, and market research", icon: "Megaphone" },
  { key: "hr", label: "Human Resources", description: "Recruiting, onboarding, and HR operations", icon: "Users" },
  { key: "finance", label: "Finance", description: "Accounting, analysis, and compliance", icon: "Calculator" },
  { key: "legal", label: "Legal", description: "Contracts, compliance, and legal research", icon: "Scale" },
  { key: "operations", label: "Operations", description: "Process management and coordination", icon: "Settings" },
];

/** Quick lookup by key */
export const CATEGORY_MAP: Record<PersonaCategory, TemplateCategory> =
  Object.fromEntries(PERSONA_CATEGORIES.map((c) => [c.key, c])) as Record<PersonaCategory, TemplateCategory>;

// ---------------------------------------------------------------------------
// Practice Mode Labels
// ---------------------------------------------------------------------------

export const PRACTICE_MODE_LABELS: Record<PracticeModeType, string> = {
  "mock-call": "Mock Call",
  "task-delegation": "Task Delegation",
  "ticket-simulation": "Ticket Simulation",
  "content-review": "Content Review",
  interview: "Interview",
  analysis: "Analysis",
  scenario: "Scenario",
};

// ---------------------------------------------------------------------------
// Default Scoring Rubrics (per practice mode)
// ---------------------------------------------------------------------------

export const DEFAULT_SCORING_DIMENSIONS: Record<PracticeModeType, ScoringDimension[]> = {
  "mock-call": [
    { key: "opening", label: "Opening & Hook", description: "Grabs attention within 10 seconds", weight: 0.2 },
    { key: "discovery", label: "Discovery Questions", description: "Asks relevant qualifying questions", weight: 0.2 },
    { key: "objection-handling", label: "Objection Handling", description: "Addresses concerns without being pushy", weight: 0.25 },
    { key: "value-prop", label: "Value Proposition", description: "Clearly articulates value for this prospect", weight: 0.2 },
    { key: "close", label: "Close / Next Steps", description: "Secures a clear next step", weight: 0.15 },
  ],
  "task-delegation": [
    { key: "understanding", label: "Task Understanding", description: "Correctly interprets the task and constraints", weight: 0.25 },
    { key: "prioritization", label: "Prioritization", description: "Handles competing priorities correctly", weight: 0.25 },
    { key: "execution", label: "Execution Quality", description: "Completes tasks accurately and completely", weight: 0.3 },
    { key: "communication", label: "Communication", description: "Proactive updates and clear confirmations", weight: 0.2 },
  ],
  "ticket-simulation": [
    { key: "diagnosis", label: "Problem Diagnosis", description: "Identifies root cause efficiently", weight: 0.3 },
    { key: "resolution", label: "Resolution Quality", description: "Provides correct and complete solutions", weight: 0.3 },
    { key: "empathy", label: "Empathy & Tone", description: "Professional and empathetic communication", weight: 0.2 },
    { key: "efficiency", label: "Efficiency", description: "Resolves quickly without unnecessary back-and-forth", weight: 0.2 },
  ],
  "content-review": [
    { key: "relevance", label: "Relevance", description: "Content matches the brief and audience", weight: 0.25 },
    { key: "clarity", label: "Clarity & Structure", description: "Well-organized and easy to follow", weight: 0.25 },
    { key: "voice", label: "Brand Voice", description: "Consistent with brand tone and style", weight: 0.25 },
    { key: "actionability", label: "Call to Action", description: "Clear and compelling next steps", weight: 0.25 },
  ],
  interview: [
    { key: "preparation", label: "Preparation", description: "Shows knowledge of candidate/role", weight: 0.2 },
    { key: "questioning", label: "Question Quality", description: "Asks revealing and relevant questions", weight: 0.3 },
    { key: "evaluation", label: "Evaluation Accuracy", description: "Correctly assesses candidate fit", weight: 0.3 },
    { key: "experience", label: "Candidate Experience", description: "Professional and engaging interaction", weight: 0.2 },
  ],
  analysis: [
    { key: "accuracy", label: "Accuracy", description: "Correct calculations and conclusions", weight: 0.3 },
    { key: "completeness", label: "Completeness", description: "Covers all relevant factors", weight: 0.25 },
    { key: "insight", label: "Insight Quality", description: "Provides actionable recommendations", weight: 0.25 },
    { key: "presentation", label: "Presentation", description: "Clear, well-structured output", weight: 0.2 },
  ],
  scenario: [
    { key: "understanding", label: "Situation Understanding", description: "Correctly grasps the scenario", weight: 0.25 },
    { key: "response", label: "Response Quality", description: "Appropriate and effective actions", weight: 0.3 },
    { key: "communication", label: "Communication", description: "Clear and professional interaction", weight: 0.25 },
    { key: "adaptability", label: "Adaptability", description: "Adjusts to changing conditions", weight: 0.2 },
  ],
};

// ---------------------------------------------------------------------------
// Status Labels & Colors
// ---------------------------------------------------------------------------

export const PERSONA_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  configuring: "Configuring",
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

export const PERSONA_STATUS_COLORS: Record<string, string> = {
  draft: "text-muted-foreground",
  configuring: "text-amber-500",
  active: "text-emerald-500",
  paused: "text-orange-500",
  archived: "text-muted-foreground",
};
