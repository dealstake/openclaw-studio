/**
 * Barrel re-export for heartbeat utilities.
 *
 * Previously a 266-line mixed-concerns module — now decomposed into:
 * - heartbeat-types.ts: Type definitions
 * - heartbeat-format.ts: Settings resolution and formatting
 * - heartbeat-api.ts: Gateway API calls
 */

export type {
  AgentHeartbeatActiveHours,
  AgentHeartbeat,
  AgentHeartbeatResult,
  AgentHeartbeatUpdatePayload,
  AgentHeartbeatSummary,
  HeartbeatListResult,
  HeartbeatWakeResult,
} from "./heartbeat-types";

export { resolveHeartbeatSettings, buildHeartbeatOverride } from "./heartbeat-format";

export {
  listHeartbeatsForAgent,
  triggerHeartbeatNow,
  updateGatewayHeartbeat,
  removeGatewayHeartbeatOverride,
} from "./heartbeat-api";
