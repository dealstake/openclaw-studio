/**
 * Per-category web research topics and reputable source lists.
 * The discovery engine uses these to trigger real-time web_search calls
 * during persona building, enriching the persona with current best practices.
 */

import type { PersonaCategory } from "./personaTypes";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A research topic the builder can search for during discovery */
export interface ResearchTopic {
  /** Unique key */
  key: string;
  /** Human-readable label */
  label: string;
  /** Search query template — {{company}}, {{industry}}, {{role}} are replaced at runtime */
  queryTemplate: string;
  /** When to trigger this research (phase key from discoveryQuestions) */
  triggerPhase: string;
  /** Keywords in user answers that trigger this search */
  triggerKeywords?: string[];
}

/** Reputable sources for a category — used to filter/prioritize search results */
export interface CategorySource {
  /** Source name */
  name: string;
  /** Domain for matching */
  domain: string;
  /** What this source is good for */
  expertise: string;
}

/** Complete research config for a category */
export interface CategoryResearchConfig {
  category: PersonaCategory;
  topics: ResearchTopic[];
  sources: CategorySource[];
}

// ---------------------------------------------------------------------------
// Research Configs
// ---------------------------------------------------------------------------

const SALES_RESEARCH: CategoryResearchConfig = {
  category: "sales",
  topics: [
    {
      key: "sales-methodology",
      label: "Sales Methodology",
      queryTemplate: "best sales methodology for {{industry}} 2025 2026",
      triggerPhase: "sales-process",
      triggerKeywords: ["methodology", "challenger", "meddic", "spin", "sandler"],
    },
    {
      key: "cold-outreach-best-practices",
      label: "Cold Outreach",
      queryTemplate: "cold outreach best practices {{industry}} B2B 2025",
      triggerPhase: "sales-process",
      triggerKeywords: ["cold call", "cold email", "outbound", "prospecting"],
    },
    {
      key: "icp-research",
      label: "ICP Research",
      queryTemplate: "{{industry}} ideal customer profile decision makers buying process",
      triggerPhase: "sales-process",
    },
    {
      key: "objection-frameworks",
      label: "Objection Handling",
      queryTemplate: "common sales objections {{industry}} how to handle",
      triggerPhase: "sales-process",
      triggerKeywords: ["objection", "pushback", "concern"],
    },
    {
      key: "sales-tools",
      label: "Sales Tech Stack",
      queryTemplate: "best sales tools CRM {{industry}} 2025",
      triggerPhase: "company-context",
      triggerKeywords: ["crm", "salesforce", "hubspot", "tools"],
    },
  ],
  sources: [
    { name: "Gong Labs", domain: "gong.io", expertise: "Conversation intelligence and sales data" },
    { name: "SalesHacker", domain: "saleshacker.com", expertise: "Outbound and SDR tactics" },
    { name: "HubSpot Blog", domain: "hubspot.com", expertise: "Inbound sales and CRM" },
    { name: "Close.io Blog", domain: "close.com", expertise: "SMB sales and cold calling" },
    { name: "Jeb Blount / Sales Gravy", domain: "salesgravy.com", expertise: "Prospecting methodology" },
  ],
};

const ADMIN_RESEARCH: CategoryResearchConfig = {
  category: "admin",
  topics: [
    {
      key: "ea-best-practices",
      label: "EA Best Practices",
      queryTemplate: "executive assistant best practices 2025 productivity",
      triggerPhase: "admin-scope",
    },
    {
      key: "calendar-management",
      label: "Calendar Management",
      queryTemplate: "executive calendar management strategies multiple timezone",
      triggerPhase: "admin-scope",
      triggerKeywords: ["calendar", "scheduling", "timezone"],
    },
    {
      key: "meeting-prep",
      label: "Meeting Preparation",
      queryTemplate: "executive meeting preparation checklist briefing document template",
      triggerPhase: "admin-scope",
      triggerKeywords: ["meeting", "prep", "briefing"],
    },
    {
      key: "travel-management",
      label: "Travel Management",
      queryTemplate: "corporate travel management best practices tools",
      triggerPhase: "admin-scope",
      triggerKeywords: ["travel", "booking", "flights"],
    },
  ],
  sources: [
    { name: "The Assist", domain: "theassistant.com", expertise: "EA community and resources" },
    { name: "Base", domain: "base.app", expertise: "EA platform and best practices" },
    { name: "Belay", domain: "belaysolutions.com", expertise: "Virtual assistant operations" },
  ],
};

const SUPPORT_RESEARCH: CategoryResearchConfig = {
  category: "support",
  topics: [
    {
      key: "support-metrics",
      label: "Support Metrics",
      queryTemplate: "customer support KPIs benchmarks {{industry}} 2025",
      triggerPhase: "support-scope",
    },
    {
      key: "troubleshooting-frameworks",
      label: "Troubleshooting",
      queryTemplate: "{{product_type}} troubleshooting framework tiered support",
      triggerPhase: "support-scope",
      triggerKeywords: ["troubleshoot", "diagnose", "debug"],
    },
    {
      key: "knowledge-management",
      label: "Knowledge Base",
      queryTemplate: "internal knowledge base best practices support teams",
      triggerPhase: "support-scope",
      triggerKeywords: ["knowledge base", "documentation", "wiki", "faq"],
    },
    {
      key: "escalation-frameworks",
      label: "Escalation",
      queryTemplate: "support escalation matrix best practices SLA",
      triggerPhase: "support-scope",
      triggerKeywords: ["escalation", "hand off", "tier"],
    },
  ],
  sources: [
    { name: "Zendesk Blog", domain: "zendesk.com", expertise: "Support operations and benchmarks" },
    { name: "Intercom Blog", domain: "intercom.com", expertise: "Modern support and automation" },
    { name: "Help Scout", domain: "helpscout.com", expertise: "Small team support" },
    { name: "Support Driven", domain: "supportdriven.com", expertise: "Support community" },
  ],
};

const MARKETING_RESEARCH: CategoryResearchConfig = {
  category: "marketing",
  topics: [
    {
      key: "content-strategy",
      label: "Content Strategy",
      queryTemplate: "{{industry}} content marketing strategy 2025 2026",
      triggerPhase: "marketing-scope",
    },
    {
      key: "seo-best-practices",
      label: "SEO",
      queryTemplate: "SEO best practices {{industry}} content optimization 2025",
      triggerPhase: "marketing-scope",
      triggerKeywords: ["seo", "search", "organic", "blog"],
    },
    {
      key: "email-marketing",
      label: "Email Marketing",
      queryTemplate: "email marketing benchmarks open rates {{industry}} 2025",
      triggerPhase: "marketing-scope",
      triggerKeywords: ["email", "newsletter", "drip"],
    },
    {
      key: "competitor-content",
      label: "Competitor Analysis",
      queryTemplate: "{{competitor}} content strategy marketing approach",
      triggerPhase: "marketing-scope",
      triggerKeywords: ["competitor", "competing"],
    },
    {
      key: "social-strategy",
      label: "Social Media",
      queryTemplate: "{{industry}} social media strategy B2B LinkedIn 2025",
      triggerPhase: "marketing-scope",
      triggerKeywords: ["social", "linkedin", "twitter", "instagram"],
    },
  ],
  sources: [
    { name: "HubSpot Blog", domain: "hubspot.com", expertise: "Inbound marketing" },
    { name: "Content Marketing Institute", domain: "contentmarketinginstitute.com", expertise: "Content strategy" },
    { name: "Ahrefs Blog", domain: "ahrefs.com", expertise: "SEO and content research" },
    { name: "Demand Curve", domain: "demandcurve.com", expertise: "Growth tactics" },
  ],
};

const HR_RESEARCH: CategoryResearchConfig = {
  category: "hr",
  topics: [
    {
      key: "recruiting-best-practices",
      label: "Recruiting",
      queryTemplate: "recruiting best practices {{industry}} 2025 hiring",
      triggerPhase: "hr-scope",
      triggerKeywords: ["recruit", "hiring", "talent"],
    },
    {
      key: "onboarding",
      label: "Onboarding",
      queryTemplate: "employee onboarding best practices checklist 2025",
      triggerPhase: "hr-scope",
      triggerKeywords: ["onboarding", "new hire"],
    },
    {
      key: "compliance-hr",
      label: "HR Compliance",
      queryTemplate: "HR compliance requirements {{jurisdiction}} employment law 2025",
      triggerPhase: "hr-scope",
      triggerKeywords: ["compliance", "eeoc", "gdpr", "labor law"],
    },
    {
      key: "employer-branding",
      label: "Employer Brand",
      queryTemplate: "employer branding strategies {{industry}} attract talent",
      triggerPhase: "hr-scope",
      triggerKeywords: ["culture", "brand", "attract"],
    },
  ],
  sources: [
    { name: "SHRM", domain: "shrm.org", expertise: "HR standards and compliance" },
    { name: "Lever Blog", domain: "lever.co", expertise: "Recruiting and ATS" },
    { name: "Greenhouse Blog", domain: "greenhouse.io", expertise: "Structured hiring" },
    { name: "BambooHR", domain: "bamboohr.com", expertise: "SMB HR operations" },
  ],
};

const FINANCE_RESEARCH: CategoryResearchConfig = {
  category: "finance",
  topics: [
    {
      key: "financial-reporting",
      label: "Financial Reporting",
      queryTemplate: "financial reporting best practices {{industry}} small business",
      triggerPhase: "finance-scope",
    },
    {
      key: "automation-finance",
      label: "Finance Automation",
      queryTemplate: "accounts payable receivable automation tools 2025",
      triggerPhase: "finance-scope",
      triggerKeywords: ["automation", "ap", "ar", "payable", "receivable"],
    },
    {
      key: "budgeting-frameworks",
      label: "Budgeting",
      queryTemplate: "budgeting forecasting frameworks small business startup",
      triggerPhase: "finance-scope",
      triggerKeywords: ["budget", "forecast", "planning"],
    },
    {
      key: "compliance-finance",
      label: "Financial Compliance",
      queryTemplate: "{{compliance_req}} compliance requirements small business",
      triggerPhase: "finance-scope",
      triggerKeywords: ["sox", "gaap", "compliance", "audit"],
    },
  ],
  sources: [
    { name: "CFO.com", domain: "cfo.com", expertise: "Finance leadership" },
    { name: "Journal of Accountancy", domain: "journalofaccountancy.com", expertise: "Accounting standards" },
    { name: "Bench Blog", domain: "bench.co", expertise: "Small business bookkeeping" },
    { name: "Float Blog", domain: "floatapp.com", expertise: "Cash flow management" },
  ],
};

const LEGAL_RESEARCH: CategoryResearchConfig = {
  category: "legal",
  topics: [
    {
      key: "contract-best-practices",
      label: "Contract Management",
      queryTemplate: "contract management best practices {{industry}} 2025",
      triggerPhase: "legal-scope",
    },
    {
      key: "compliance-monitoring",
      label: "Compliance",
      queryTemplate: "regulatory compliance monitoring {{jurisdiction}} {{industry}}",
      triggerPhase: "legal-scope",
      triggerKeywords: ["compliance", "regulatory", "monitor"],
    },
    {
      key: "legal-tech",
      label: "Legal Tech",
      queryTemplate: "legal technology tools contract review AI 2025",
      triggerPhase: "company-context",
      triggerKeywords: ["tool", "software", "tech"],
    },
    {
      key: "ip-management",
      label: "IP Management",
      queryTemplate: "intellectual property management best practices startups",
      triggerPhase: "legal-scope",
      triggerKeywords: ["ip", "patent", "trademark", "copyright"],
    },
  ],
  sources: [
    { name: "Above the Law", domain: "abovethelaw.com", expertise: "Legal industry trends" },
    { name: "Clio Blog", domain: "clio.com", expertise: "Legal practice management" },
    { name: "Law Technology Today", domain: "lawtechnologytoday.org", expertise: "Legal tech" },
    { name: "Thomson Reuters Legal", domain: "thomsonreuters.com", expertise: "Legal research" },
  ],
};

const OPERATIONS_RESEARCH: CategoryResearchConfig = {
  category: "operations",
  topics: [
    {
      key: "process-optimization",
      label: "Process Optimization",
      queryTemplate: "operations process optimization {{industry}} lean six sigma",
      triggerPhase: "ops-scope",
    },
    {
      key: "project-management",
      label: "Project Management",
      queryTemplate: "project management best practices {{industry}} agile",
      triggerPhase: "ops-scope",
      triggerKeywords: ["project", "agile", "scrum", "kanban"],
    },
    {
      key: "vendor-management",
      label: "Vendor Management",
      queryTemplate: "vendor management best practices evaluation scorecard",
      triggerPhase: "ops-scope",
      triggerKeywords: ["vendor", "supplier", "procurement"],
    },
    {
      key: "ops-tools",
      label: "Ops Tools",
      queryTemplate: "operations management tools {{industry}} automation 2025",
      triggerPhase: "company-context",
      triggerKeywords: ["tool", "software", "platform"],
    },
  ],
  sources: [
    { name: "McKinsey Operations", domain: "mckinsey.com", expertise: "Operations strategy" },
    { name: "Process Street", domain: "process.st", expertise: "Process documentation" },
    { name: "Asana Blog", domain: "asana.com", expertise: "Work management" },
    { name: "Monday.com Blog", domain: "monday.com", expertise: "Project management" },
  ],
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** All category research configs */
export const CATEGORY_RESEARCH: Record<PersonaCategory, CategoryResearchConfig> = {
  sales: SALES_RESEARCH,
  admin: ADMIN_RESEARCH,
  support: SUPPORT_RESEARCH,
  marketing: MARKETING_RESEARCH,
  hr: HR_RESEARCH,
  finance: FINANCE_RESEARCH,
  legal: LEGAL_RESEARCH,
  operations: OPERATIONS_RESEARCH,
};

/**
 * Get research topics that should trigger for a given phase and answer keywords.
 */
export function getTriggeredTopics(
  category: PersonaCategory,
  phaseKey: string,
  answerText?: string,
): ResearchTopic[] {
  const config = CATEGORY_RESEARCH[category];
  const lowerAnswer = answerText?.toLowerCase() ?? "";

  return config.topics.filter((topic) => {
    if (topic.triggerPhase !== phaseKey) return false;
    // If no trigger keywords, always trigger for this phase
    if (!topic.triggerKeywords || topic.triggerKeywords.length === 0) return true;
    // Otherwise, check if any keyword appears in the answer
    return topic.triggerKeywords.some((kw) => lowerAnswer.includes(kw));
  });
}

/**
 * Fill a query template with context values.
 */
export function fillQueryTemplate(
  template: string,
  context: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(context)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  // Remove unfilled placeholders
  result = result.replaceAll(/\{\{[^}]+\}\}/g, "").replaceAll(/\s{2,}/g, " ").trim();
  return result;
}
