// ─── Task Templates ──────────────────────────────────────────────────────────
// Pre-built common task configurations for quick creation.

import type { TaskType, CreateTaskPayload } from "../types";

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  type: TaskType;
  icon: string; // emoji
  category: string;
  /** Generates a CreateTaskPayload given an agentId */
  build: (agentId: string) => CreateTaskPayload;
}

export const TASK_TEMPLATES: TaskTemplate[] = [
  {
    id: "email-monitor",
    name: "Email Monitor",
    description: "Watch inbox for urgent emails and flag important ones",
    type: "constant",
    icon: "📧",
    category: "Monitoring",
    build: (agentId) => ({
      agentId,
      name: "Email Monitor",
      description: "Monitors inbox for urgent emails and flags important messages",
      type: "constant",
      schedule: { type: "constant", intervalMs: 300_000 },
      prompt: `[TASK:{taskId}] Monitor the inbox for urgent emails.

State Management:
1. Read your previous state from tasks/{taskId}/state.json
2. Check for new emails since your last check
3. Flag emails containing keywords: "urgent", "ASAP", "deadline", "funding", "approval needed"
4. Flag emails from VIP contacts or with large dollar amounts
5. Write updated state back to tasks/{taskId}/state.json
6. ONLY report NEW emails since your last check

If state.json doesn't exist, this is your first run — create it and report what you find.
If nothing new, respond briefly: "No new urgent emails."`,
      model: "anthropic/claude-haiku-3.5",
    }),
  },
  {
    id: "daily-summary",
    name: "Daily Pipeline Summary",
    description: "Morning briefing with active deals, new applications, and blockers",
    type: "scheduled",
    icon: "📊",
    category: "Reports",
    build: (agentId) => ({
      agentId,
      name: "Daily Pipeline Summary",
      description: "Generates a morning briefing with active deals and pipeline status",
      type: "scheduled",
      schedule: {
        type: "scheduled",
        days: [1, 2, 3, 4, 5],
        times: ["09:00"],
        timezone: "America/New_York",
      },
      prompt: `[TASK:{taskId}] Generate today's deal pipeline summary.

Include:
- Total active deals and their current status
- New applications received since yesterday
- Deals closing this week (with amounts and deadlines)
- Any blocked items requiring immediate attention
- Key metrics: total pipeline value, conversion rate trend, average time to close

Format as a clean, scannable report with headers and bullet points.
Lead with the most important/actionable items.`,
      model: "anthropic/claude-opus-4-6",
    }),
  },
  {
    id: "lead-processor",
    name: "Lead Processor",
    description: "Check for new applications and qualify incoming leads",
    type: "periodic",
    icon: "🎯",
    category: "Processing",
    build: (agentId) => ({
      agentId,
      name: "Lead Processor",
      description: "Checks for new applications and qualifies incoming leads",
      type: "periodic",
      schedule: { type: "periodic", intervalMs: 900_000 },
      prompt: `[TASK:{taskId}] Check for new MCA applications and qualify leads.

State Management:
1. Read previous state from tasks/{taskId}/state.json
2. Check for new applications since last run
3. For each new application, assess:
   - Business type and age
   - Revenue figures
   - Requested amount vs qualifying range
   - Risk indicators
4. Categorize as: Hot Lead, Warm Lead, Cold Lead, or Needs Review
5. Update state file with processed application IDs
6. Only report NEW applications

Output: Concise list of new leads with qualification status and recommended next steps.`,
      model: "anthropic/claude-sonnet-4-6",
    }),
  },
  {
    id: "competitor-watch",
    name: "Competitor Watch",
    description: "Monitor competitor pricing, offerings, and market changes",
    type: "periodic",
    icon: "👀",
    category: "Monitoring",
    build: (agentId) => ({
      agentId,
      name: "Competitor Watch",
      description: "Monitors competitor pricing and market changes",
      type: "periodic",
      schedule: { type: "periodic", intervalMs: 14_400_000 },
      prompt: `[TASK:{taskId}] Monitor competitor landscape for changes.

State Management:
1. Read previous state from tasks/{taskId}/state.json
2. Check for changes in competitor pricing, terms, or offerings
3. Monitor industry news and regulatory changes
4. Compare against last-known state
5. Update state file
6. Only report CHANGES since last check

Focus on: pricing changes, new products/services, market positioning shifts, regulatory updates.
If nothing changed, respond briefly: "No competitor changes detected."`,
      model: "anthropic/claude-sonnet-4-6",
    }),
  },
  {
    id: "weekly-recap",
    name: "Weekly Recap",
    description: "End-of-week summary with metrics, wins, and action items",
    type: "scheduled",
    icon: "📋",
    category: "Reports",
    build: (agentId) => ({
      agentId,
      name: "Weekly Recap",
      description: "Generates end-of-week summary with metrics and highlights",
      type: "scheduled",
      schedule: {
        type: "scheduled",
        days: [5],
        times: ["17:00"],
        timezone: "America/New_York",
      },
      prompt: `[TASK:{taskId}] Generate the weekly recap report.

Include:
- Week's key metrics: deals closed, revenue, new leads, conversion rate
- Wins: successful deals, milestones reached
- Challenges: issues encountered, deals lost, blockers
- Pipeline outlook: next week's priorities and expected closings
- Action items: specific tasks for the coming week

Format as a polished report suitable for team review.
Use clear sections with headers.
Include specific numbers and comparisons to the previous week where possible.`,
      model: "anthropic/claude-opus-4-6",
    }),
  },
  {
    id: "pipeline-update",
    name: "Pipeline Update",
    description: "Refresh deal pipeline data and update tracking spreadsheet",
    type: "periodic",
    icon: "🔄",
    category: "Processing",
    build: (agentId) => ({
      agentId,
      name: "Pipeline Update",
      description: "Refreshes deal pipeline data and updates tracking",
      type: "periodic",
      schedule: { type: "periodic", intervalMs: 7_200_000 },
      prompt: `[TASK:{taskId}] Update the deal pipeline tracking data.

State Management:
1. Read previous state from tasks/{taskId}/state.json
2. Check all active deals for status changes
3. Update pipeline stages, amounts, and probability scores
4. Flag any deals that have been stagnant for too long
5. Write updated state back
6. Report only changes since last run

Focus on: stage transitions, amount changes, new notes or activity, approaching deadlines.`,
      model: "anthropic/claude-sonnet-4-6",
    }),
  },
];
