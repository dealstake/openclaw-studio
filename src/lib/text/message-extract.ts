/**
 * Barrel re-export for message extraction utilities.
 *
 * Previously a 481-line god module — now decomposed into:
 * - extract-text.ts: Text extraction, envelope stripping, caching
 * - extract-thinking.ts: Thinking/reasoning extraction, tagged stream parsing
 * - extract-tools.ts: Tool call/result extraction and markdown formatting
 * - ui-metadata.ts: UI metadata stripping, heartbeat detection
 */

export { extractText, extractTextCached, extractRawText, extractImages, stripEnvelope } from "./extract-text";
export {
  extractThinking,
  extractThinkingCached,
  extractThinkingFromTaggedText,
  extractThinkingFromTaggedStream,
  formatThinkingMarkdown,
  isTraceMarkdown,
  stripTraceMarkdown,
} from "./extract-thinking";
export {
  extractToolCalls,
  extractToolResult,
  extractToolLines,
  formatToolCallMarkdown,
  formatToolResultMarkdown,
  isToolMarkdown,
  parseToolMarkdown,
} from "./extract-tools";
export {
  stripUiMetadata,
  isHeartbeatPrompt,
  isUiMetadataPrefix,
  buildAgentInstruction,
} from "./ui-metadata";
export type { AgentInstructionParams } from "./ui-metadata";
