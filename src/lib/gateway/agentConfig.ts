// Barrel re-export — agentConfig.ts decomposed into focused modules.
// Consumers can import from here for backward compatibility, or directly from:
//   - @/lib/gateway/agentConfigTypes  (shared types + config list helpers)
//   - @/lib/gateway/configMutation    (generic config patch/mutation pattern)
//   - @/lib/gateway/agentCrud         (create/rename/delete agents)
//   - @/lib/gateway/heartbeat         (heartbeat types + CRUD)

export type {
  ConfigAgentEntry,
  GatewayConfigSnapshot,
} from "@/lib/gateway/agentConfigTypes";

export {
  readConfigAgentList,
  writeConfigAgentList,
  upsertConfigAgentEntry,
} from "@/lib/gateway/agentConfigTypes";

export type {
  GatewayConfigMutationResult,
} from "@/lib/gateway/configMutation";

export {
  shouldRetryConfigPatch,
  applyGatewayConfigPatch,
  withGatewayConfigMutation,
} from "@/lib/gateway/configMutation";

export {
  renameGatewayAgent,
  createGatewayAgent,
  deleteGatewayAgent,
} from "@/lib/gateway/agentCrud";

export type {
  AgentHeartbeatActiveHours,
  AgentHeartbeat,
  AgentHeartbeatResult,
  AgentHeartbeatUpdatePayload,
  AgentHeartbeatSummary,
  HeartbeatListResult,
  HeartbeatWakeResult,
} from "@/lib/gateway/heartbeat";

export {
  resolveHeartbeatSettings,
  listHeartbeatsForAgent,
  triggerHeartbeatNow,
  updateGatewayHeartbeat,
  removeGatewayHeartbeatOverride,
} from "@/lib/gateway/heartbeat";
