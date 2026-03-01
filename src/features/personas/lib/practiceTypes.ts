/**
 * Practice mode types — session state, prospect/scenario profiles, and transcript types.
 */

import type { PracticeModeType, PracticeScore, ScoringDimension } from "./personaTypes";

// ---------------------------------------------------------------------------
// Practice Session
// ---------------------------------------------------------------------------

/** Current state of a practice session */
export type PracticeSessionStatus = "active" | "completed" | "abandoned";

/** A single practice session */
export interface PracticeSession {
  /** Unique session ID */
  sessionId: string;
  /** Persona this session belongs to */
  personaId: string;
  /** Practice mode used */
  mode: PracticeModeType;
  /** Session status */
  status: PracticeSessionStatus;
  /** Scoring dimensions for this session */
  scoringDimensions: ScoringDimension[];
  /** ISO timestamp when session started */
  startedAt: string;
  /** ISO timestamp when session ended (null if active) */
  endedAt: string | null;
  /** Final score (null if not yet scored) */
  score: PracticeScore | null;
  /** Transcript of the practice interaction */
  transcript: PracticeTranscriptEntry[];
  /** Scenario/profile used for this session */
  scenarioProfile: ScenarioProfile;
}

// ---------------------------------------------------------------------------
// Transcript
// ---------------------------------------------------------------------------

/** Role in a practice transcript */
export type TranscriptRole = "user" | "persona" | "system" | "evaluator";

/** A single entry in the practice transcript */
export interface PracticeTranscriptEntry {
  /** Who sent this message */
  role: TranscriptRole;
  /** Message content */
  content: string;
  /** ISO timestamp */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Scenario Profiles (the "other side" of the practice)
// ---------------------------------------------------------------------------

/** Base scenario profile — shared fields across all practice modes */
export interface ScenarioProfileBase {
  /** Practice mode this profile is for */
  mode: PracticeModeType;
  /** Human-readable name for the scenario */
  name: string;
  /** Brief description of the scenario */
  description: string;
  /** Difficulty level */
  difficulty: "easy" | "medium" | "hard";
}

/** Mock call prospect profile */
export interface ProspectProfile extends ScenarioProfileBase {
  mode: "mock-call";
  /** Prospect's company */
  company: string;
  /** Prospect's title */
  title: string;
  /** Industry vertical */
  industry: string;
  /** Company size range */
  companySize: string;
  /** Current solution they use (if any) */
  currentSolution?: string;
  /** Pain points to discover */
  painPoints: string[];
  /** Objections they'll raise */
  objections: string[];
  /** Budget range */
  budgetRange?: string;
  /** How receptive they are (1-10) */
  receptiveness: number;
}

/** Task delegation profile */
export interface TaskDelegationProfile extends ScenarioProfileBase {
  mode: "task-delegation";
  /** Tasks to delegate */
  tasks: Array<{
    description: string;
    priority: "urgent" | "high" | "medium" | "low";
    deadline?: string;
    constraints?: string[];
  }>;
  /** Competing priorities or curveballs */
  complications: string[];
}

/** Ticket simulation profile */
export interface TicketProfile extends ScenarioProfileBase {
  mode: "ticket-simulation";
  /** Issue category */
  issueCategory: string;
  /** Issue description (what the "customer" will say) */
  issueDescription: string;
  /** Root cause (for evaluator) */
  rootCause: string;
  /** Correct resolution steps */
  resolutionSteps: string[];
  /** Customer frustration level (1-10) */
  frustrationLevel: number;
}

/** Content review profile */
export interface ContentReviewProfile extends ScenarioProfileBase {
  mode: "content-review";
  /** Content type to produce */
  contentType: string;
  /** Brief/requirements */
  brief: string;
  /** Target audience */
  targetAudience: string;
  /** Brand voice guidelines */
  brandVoice: string;
  /** Key messages that must be included */
  keyMessages: string[];
}

/** Interview profile */
export interface InterviewProfile extends ScenarioProfileBase {
  mode: "interview";
  /** Role being hired for */
  roleTitle: string;
  /** Key requirements */
  requirements: string[];
  /** Candidate background (for the persona to assess) */
  candidateBackground: string;
  /** Red flags to catch */
  redFlags: string[];
  /** Green flags to look for */
  greenFlags: string[];
}

/** Analysis profile */
export interface AnalysisProfile extends ScenarioProfileBase {
  mode: "analysis";
  /** Type of analysis (financial, compliance, market, etc.) */
  analysisType: string;
  /** Data or scenario to analyze */
  dataDescription: string;
  /** Key questions to answer */
  questions: string[];
  /** Expected conclusions (for evaluator) */
  expectedConclusions: string[];
}

/** Generic scenario profile (catch-all) */
export interface GenericScenarioProfile extends ScenarioProfileBase {
  mode: "scenario";
  /** Scenario setup text */
  setup: string;
  /** Goals the persona should achieve */
  goals: string[];
  /** Success criteria */
  successCriteria: string[];
}

/** Union type of all scenario profiles */
export type ScenarioProfile =
  | ProspectProfile
  | TaskDelegationProfile
  | TicketProfile
  | ContentReviewProfile
  | InterviewProfile
  | AnalysisProfile
  | GenericScenarioProfile;

// ---------------------------------------------------------------------------
// Practice Configuration
// ---------------------------------------------------------------------------

/** Configuration for starting a practice session */
export interface PracticeConfig {
  /** Persona to practice with */
  personaId: string;
  /** Practice mode */
  mode: PracticeModeType;
  /** Scenario profile to use (if null, auto-generate) */
  scenarioProfile?: ScenarioProfile;
  /** Difficulty override */
  difficulty?: "easy" | "medium" | "hard";
  /** Custom scoring dimensions (overrides defaults) */
  customDimensions?: ScoringDimension[];
}

/** Summary of practice history for a persona */
export interface PracticeHistory {
  /** Total sessions completed */
  totalSessions: number;
  /** Sessions by mode */
  sessionsByMode: Partial<Record<PracticeModeType, number>>;
  /** Recent scores (last 10) */
  recentScores: PracticeScore[];
  /** Overall improvement trend (-1 to 1) */
  improvementTrend: number;
  /** Weakest dimensions across all sessions */
  weakestDimensions: Array<{ key: string; label: string; averageScore: number }>;
  /** Strongest dimensions */
  strongestDimensions: Array<{ key: string; label: string; averageScore: number }>;
}
