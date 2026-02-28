/**
 * Category-specific question banks for the persona discovery engine.
 * Used by both template-aware and from-scratch flows.
 *
 * Each category has phased questions that guide a conversational interview.
 * The builder prompt selects questions dynamically based on prior answers.
 */

import type { PersonaCategory } from "./personaTypes";

// ---------------------------------------------------------------------------
// Question Bank Entry
// ---------------------------------------------------------------------------

/** A single discovery question with context for when to ask it */
export interface DiscoveryQuestion {
  /** Unique key within its phase */
  key: string;
  /** The question text (conversational, not form-like) */
  question: string;
  /** Follow-up triggers: if the answer contains these keywords, ask follow-ups */
  followUpTriggers?: string[];
  /** Follow-up questions triggered by keywords above */
  followUps?: string[];
  /** Whether this question is essential (vs. nice-to-have) */
  essential: boolean;
}

/** A phase of discovery questions */
export interface DiscoveryQuestionPhase {
  /** Phase key, e.g. "company-context" */
  key: string;
  /** Human-readable phase title */
  title: string;
  /** Questions in this phase */
  questions: DiscoveryQuestion[];
}

/** Full question bank for a category */
export interface CategoryQuestionBank {
  category: PersonaCategory;
  phases: DiscoveryQuestionPhase[];
}

// ---------------------------------------------------------------------------
// Shared Phases (used across all categories)
// ---------------------------------------------------------------------------

const COMPANY_CONTEXT_PHASE: DiscoveryQuestionPhase = {
  key: "company-context",
  title: "Company & Industry",
  questions: [
    {
      key: "company-name",
      question: "What's the name of your company or organization?",
      essential: true,
    },
    {
      key: "industry",
      question: "What industry are you in? If it's a niche, give me the specifics — 'fintech lending' is more useful than just 'finance'.",
      followUpTriggers: ["saas", "software", "tech"],
      followUps: [
        "What's your typical deal size or ACV range?",
        "Is your sales cycle more transactional (days) or enterprise (months)?",
      ],
      essential: true,
    },
    {
      key: "company-size",
      question: "Roughly how large is your team? Solo founder, small team (2-10), mid-size (10-50), or larger?",
      essential: false,
    },
    {
      key: "existing-tools",
      question: "What tools do you already use day-to-day? (CRM, email, calendar, project management, etc.)",
      essential: true,
    },
  ],
};

const COMMUNICATION_PHASE: DiscoveryQuestionPhase = {
  key: "communication",
  title: "Communication Style",
  questions: [
    {
      key: "tone",
      question: "How should this persona communicate? Formal and polished, casual and direct, somewhere in between?",
      essential: true,
    },
    {
      key: "channels",
      question: "What communication channels does this persona need? Email, WhatsApp, iMessage, Slack, phone/voice?",
      essential: true,
    },
    {
      key: "audience",
      question: "Who will this persona primarily interact with? Internal team, customers, prospects, vendors?",
      essential: true,
    },
  ],
};

const GOALS_PHASE: DiscoveryQuestionPhase = {
  key: "goals",
  title: "Goals & Success Criteria",
  questions: [
    {
      key: "primary-goal",
      question: "What's the #1 thing you want this persona to achieve? Be specific — 'book 10 demos per week' is better than 'help with sales'.",
      essential: true,
    },
    {
      key: "pain-points",
      question: "What's currently painful about doing this work manually? What drops through the cracks?",
      essential: true,
    },
    {
      key: "success-metric",
      question: "How will you know it's working? What metric or outcome tells you this persona is earning its keep?",
      essential: false,
    },
  ],
};

// ---------------------------------------------------------------------------
// Category-Specific Question Banks
// ---------------------------------------------------------------------------

const SALES_QUESTIONS: CategoryQuestionBank = {
  category: "sales",
  phases: [
    COMPANY_CONTEXT_PHASE,
    {
      key: "sales-process",
      title: "Sales Process",
      questions: [
        {
          key: "icp",
          question: "Describe your ideal customer. What titles, company sizes, and industries are you targeting?",
          followUpTriggers: ["enterprise", "mid-market", "smb"],
          followUps: [
            "What's your typical sales cycle length?",
            "How many stakeholders are usually involved in the buying decision?",
          ],
          essential: true,
        },
        {
          key: "value-prop",
          question: "In one sentence, what problem do you solve that your competitors don't?",
          essential: true,
        },
        {
          key: "objections",
          question: "What are the top 3 objections you hear from prospects?",
          essential: true,
        },
        {
          key: "methodology",
          question: "Do you follow a specific sales methodology? (Challenger, MEDDIC, SPIN, Sandler, or just your own approach)",
          essential: false,
        },
        {
          key: "outbound-channels",
          question: "How do you reach prospects? Cold calls, cold email, LinkedIn, referrals, events?",
          essential: true,
        },
      ],
    },
    COMMUNICATION_PHASE,
    GOALS_PHASE,
  ],
};

const ADMIN_QUESTIONS: CategoryQuestionBank = {
  category: "admin",
  phases: [
    COMPANY_CONTEXT_PHASE,
    {
      key: "admin-scope",
      title: "Administrative Scope",
      questions: [
        {
          key: "executive",
          question: "Who does this persona support? A specific executive, a team, or the whole company?",
          essential: true,
        },
        {
          key: "calendar-complexity",
          question: "How complex is the calendar management? Single calendar, multiple executives, cross-timezone scheduling?",
          followUpTriggers: ["multiple", "executives", "timezone"],
          followUps: [
            "What are the scheduling rules? Any recurring meetings that are sacred?",
          ],
          essential: true,
        },
        {
          key: "tasks",
          question: "What recurring tasks does this role handle? Travel booking, expense reports, meeting prep, document management?",
          essential: true,
        },
        {
          key: "gatekeeping",
          question: "Does this persona need to screen requests or prioritize who gets time? What are the rules?",
          essential: false,
        },
      ],
    },
    COMMUNICATION_PHASE,
    GOALS_PHASE,
  ],
};

const SUPPORT_QUESTIONS: CategoryQuestionBank = {
  category: "support",
  phases: [
    COMPANY_CONTEXT_PHASE,
    {
      key: "support-scope",
      title: "Support Operations",
      questions: [
        {
          key: "product-type",
          question: "What product or service does this persona support? Software, hardware, SaaS, internal IT?",
          essential: true,
        },
        {
          key: "ticket-volume",
          question: "Roughly how many support requests per day/week? What's the current response time?",
          essential: true,
        },
        {
          key: "common-issues",
          question: "What are the top 5 most common issues or questions you get?",
          essential: true,
        },
        {
          key: "escalation",
          question: "What's the escalation path? When should the persona hand off to a human?",
          essential: true,
        },
        {
          key: "knowledge-base",
          question: "Do you have existing documentation, FAQs, or a knowledge base? Where does it live?",
          essential: false,
        },
      ],
    },
    COMMUNICATION_PHASE,
    GOALS_PHASE,
  ],
};

const MARKETING_QUESTIONS: CategoryQuestionBank = {
  category: "marketing",
  phases: [
    COMPANY_CONTEXT_PHASE,
    {
      key: "marketing-scope",
      title: "Marketing Focus",
      questions: [
        {
          key: "content-types",
          question: "What content does this persona create? Blog posts, emails, social media, ad copy, reports?",
          essential: true,
        },
        {
          key: "brand-voice",
          question: "Describe your brand voice. Formal? Witty? Technical? Give me an example of writing you love.",
          essential: true,
        },
        {
          key: "target-audience",
          question: "Who's the target audience for this content? Be as specific as you can.",
          essential: true,
        },
        {
          key: "platforms",
          question: "What platforms do you publish on? Website, LinkedIn, Twitter/X, newsletters, YouTube?",
          essential: true,
        },
        {
          key: "competitors",
          question: "Who are your top 2-3 competitors? I'll research their content strategy for insights.",
          essential: false,
        },
      ],
    },
    COMMUNICATION_PHASE,
    GOALS_PHASE,
  ],
};

const HR_QUESTIONS: CategoryQuestionBank = {
  category: "hr",
  phases: [
    COMPANY_CONTEXT_PHASE,
    {
      key: "hr-scope",
      title: "HR Focus",
      questions: [
        {
          key: "hr-function",
          question: "What's the primary focus? Recruiting, onboarding, employee ops, compliance, all of the above?",
          essential: true,
        },
        {
          key: "hiring-volume",
          question: "How many roles are you typically hiring for at once?",
          followUpTriggers: ["10+", "many", "always"],
          followUps: [
            "Do you use an ATS? Which one?",
            "What's your biggest bottleneck in the hiring pipeline?",
          ],
          essential: true,
        },
        {
          key: "compliance",
          question: "Are there specific compliance requirements? (EEOC, GDPR for candidates, state-specific labor laws)",
          essential: true,
        },
        {
          key: "culture",
          question: "How would you describe your company culture in 2-3 words? This shapes how the persona presents your employer brand.",
          essential: false,
        },
      ],
    },
    COMMUNICATION_PHASE,
    GOALS_PHASE,
  ],
};

const FINANCE_QUESTIONS: CategoryQuestionBank = {
  category: "finance",
  phases: [
    COMPANY_CONTEXT_PHASE,
    {
      key: "finance-scope",
      title: "Finance Operations",
      questions: [
        {
          key: "finance-function",
          question: "What's the primary function? Bookkeeping, financial analysis, accounts payable/receivable, budgeting, tax prep?",
          essential: true,
        },
        {
          key: "accounting-software",
          question: "What accounting/finance tools do you use? QuickBooks, Xero, NetSuite, Excel/Sheets?",
          essential: true,
        },
        {
          key: "reporting",
          question: "What financial reports do you need regularly? P&L, cash flow, budget vs actuals, KPI dashboards?",
          essential: true,
        },
        {
          key: "compliance-reqs",
          question: "Any regulatory compliance requirements? SOX, GAAP, industry-specific reporting?",
          essential: false,
        },
      ],
    },
    COMMUNICATION_PHASE,
    GOALS_PHASE,
  ],
};

const LEGAL_QUESTIONS: CategoryQuestionBank = {
  category: "legal",
  phases: [
    COMPANY_CONTEXT_PHASE,
    {
      key: "legal-scope",
      title: "Legal Focus",
      questions: [
        {
          key: "legal-function",
          question: "What legal work does this persona handle? Contracts, compliance monitoring, legal research, IP management?",
          essential: true,
        },
        {
          key: "contract-types",
          question: "What types of contracts do you deal with most? NDAs, service agreements, employment contracts, vendor contracts?",
          followUpTriggers: ["nda", "service", "vendor"],
          followUps: [
            "Do you have standard templates, or is every contract custom?",
          ],
          essential: true,
        },
        {
          key: "jurisdictions",
          question: "What jurisdictions do you operate in? US only, multi-state, international?",
          essential: true,
        },
        {
          key: "risk-tolerance",
          question: "What's the risk profile? Conservative (flag everything), moderate, or aggressive (only flag critical issues)?",
          essential: false,
        },
      ],
    },
    COMMUNICATION_PHASE,
    GOALS_PHASE,
  ],
};

const OPERATIONS_QUESTIONS: CategoryQuestionBank = {
  category: "operations",
  phases: [
    COMPANY_CONTEXT_PHASE,
    {
      key: "ops-scope",
      title: "Operations Scope",
      questions: [
        {
          key: "ops-function",
          question: "What operational area does this persona cover? Project management, logistics, process optimization, vendor management?",
          essential: true,
        },
        {
          key: "team-structure",
          question: "Who does this persona coordinate with? Engineering, sales, external vendors, cross-functional teams?",
          essential: true,
        },
        {
          key: "processes",
          question: "What are the key processes this persona manages? Any that are currently broken or manual?",
          essential: true,
        },
        {
          key: "pm-tools",
          question: "What project management tools do you use? Jira, Linear, Asana, Notion, spreadsheets?",
          essential: false,
        },
      ],
    },
    COMMUNICATION_PHASE,
    GOALS_PHASE,
  ],
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** All category question banks, indexed by category key */
export const CATEGORY_QUESTION_BANKS: Record<PersonaCategory, CategoryQuestionBank> = {
  sales: SALES_QUESTIONS,
  admin: ADMIN_QUESTIONS,
  support: SUPPORT_QUESTIONS,
  marketing: MARKETING_QUESTIONS,
  hr: HR_QUESTIONS,
  finance: FINANCE_QUESTIONS,
  legal: LEGAL_QUESTIONS,
  operations: OPERATIONS_QUESTIONS,
};

/**
 * Get all essential questions for a category (flattened across phases).
 * Useful for progress tracking — how many essential questions have been answered.
 */
export function getEssentialQuestionCount(category: PersonaCategory): number {
  const bank = CATEGORY_QUESTION_BANKS[category];
  return bank.phases.reduce(
    (count, phase) => count + phase.questions.filter((q) => q.essential).length,
    0,
  );
}

/**
 * Get phase titles for a category (used in progress indicators).
 */
export function getPhaseLabels(category: PersonaCategory): string[] {
  return CATEGORY_QUESTION_BANKS[category].phases.map((p) => p.title);
}
