/**
 * Shared validation helpers for required identifiers.
 *
 * Replaces duplicated `resolveJobId`, `resolveAgentId`,
 * `resolveHeartbeatAgentId` scattered across cron/types.ts,
 * gateway/agentConfig.ts, and gateway/agentFiles.ts.
 */

/**
 * Trim and validate a required string identifier.
 * Throws if the value is empty after trimming.
 */
export const resolveRequiredId = (value: string, label: string): string => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${label} is required.`);
  }
  return trimmed;
};
