import type { AgentState } from "@/features/agents/state/store";

/** Default persona fields added to AgentState — use spread in test fixtures */
export const PERSONA_DEFAULTS: Pick<
  AgentState,
  | "isMainAgent" | "personaStatus" | "personaCategory" | "roleDescription"
  | "templateKey" | "optimizationGoals" | "practiceCount"
  | "voiceProvider" | "voiceId" | "voiceModelId" | "voiceStability" | "voiceClarity" | "voiceStyle"
> = {
  isMainAgent: false,
  personaStatus: null,
  personaCategory: null,
  roleDescription: null,
  templateKey: null,
  optimizationGoals: [],
  practiceCount: 0,
  voiceProvider: null,
  voiceId: null,
  voiceModelId: null,
  voiceStability: 0.5,
  voiceClarity: 0.75,
  voiceStyle: 0,
};
