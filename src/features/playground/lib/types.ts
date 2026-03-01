/** Playground request payload — sent to the gateway via chat.send session pattern */
export interface PlaygroundRequest {
  model: string;
  systemPrompt: string;
  userMessage: string;
  temperature?: number;
  maxTokens?: number;
}

/** Playground response — assembled from gateway events */
export interface PlaygroundResponse {
  text: string;
  tokensIn?: number;
  tokensOut?: number;
  /** Milliseconds from send to final token */
  latencyMs?: number;
  estimatedCostUsd?: number;
}

/** A saved prompt preset for reuse */
export interface PromptPreset {
  id: string;
  label: string;
  systemPrompt: string;
  userMessage: string;
  model: string;
  createdAt: number;
}

/** Per-turn result stored in the playground history */
export interface PlaygroundResult {
  id: string;
  request: PlaygroundRequest;
  response: PlaygroundResponse | null;
  error: string | null;
  startedAt: number;
}
