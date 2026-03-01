/**
 * Gateway RPC client wrappers for the orchestrations.* namespace.
 *
 * These thin wrappers call GatewayClient.call() with the appropriate method names.
 * The gateway-side handlers (orchestrations.create, orchestrations.run, etc.) are
 * implemented in the OpenClaw gateway service — these functions provide the typed
 * client-side contract.
 *
 * Phase 1 also exposes sessions.dispatchParallel for flat fan-out dispatch,
 * which is the stepping stone before full graph-based orchestration.
 */

import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import type {
  CreateOrchestrationParams,
  CreateOrchestrationResult,
  DeleteOrchestrationParams,
  DeleteOrchestrationResult,
  GetOrchestrationParams,
  GetOrchestrationResult,
  ListOrchestrationsParams,
  ListOrchestrationsResult,
  OrchestrationStatusParams,
  OrchestrationStatusResult,
  ParallelDispatchParams,
  ParallelDispatchResult,
  RunOrchestrationParams,
  RunOrchestrationResult,
  UpdateOrchestrationParams,
  UpdateOrchestrationResult,
} from "./types";

/**
 * Save a new orchestration graph definition to the gateway.
 * Gateway RPC: orchestrations.create
 */
export async function createOrchestrationRpc(
  client: GatewayClient,
  params: CreateOrchestrationParams,
): Promise<CreateOrchestrationResult> {
  return client.call<CreateOrchestrationResult>("orchestrations.create", params);
}

/**
 * List all orchestrations for an agent.
 * Gateway RPC: orchestrations.list
 */
export async function listOrchestrationsRpc(
  client: GatewayClient,
  params: ListOrchestrationsParams,
): Promise<ListOrchestrationsResult> {
  return client.call<ListOrchestrationsResult>("orchestrations.list", params);
}

/**
 * Get a single orchestration by ID.
 * Gateway RPC: orchestrations.get
 */
export async function getOrchestrationRpc(
  client: GatewayClient,
  params: GetOrchestrationParams,
): Promise<GetOrchestrationResult> {
  return client.call<GetOrchestrationResult>("orchestrations.get", params);
}

/**
 * Update an orchestration's name, description, graph, or status.
 * Gateway RPC: orchestrations.update
 */
export async function updateOrchestrationRpc(
  client: GatewayClient,
  params: UpdateOrchestrationParams,
): Promise<UpdateOrchestrationResult> {
  return client.call<UpdateOrchestrationResult>("orchestrations.update", params);
}

/**
 * Delete an orchestration by ID.
 * Gateway RPC: orchestrations.delete
 */
export async function deleteOrchestrationRpc(
  client: GatewayClient,
  params: DeleteOrchestrationParams,
): Promise<DeleteOrchestrationResult> {
  return client.call<DeleteOrchestrationResult>("orchestrations.delete", params);
}

/**
 * Translate an orchestration graph into sequential/parallel agent dispatches
 * and begin execution.
 * Gateway RPC: orchestrations.run
 */
export async function runOrchestrationRpc(
  client: GatewayClient,
  params: RunOrchestrationParams,
): Promise<RunOrchestrationResult> {
  return client.call<RunOrchestrationResult>("orchestrations.run", params);
}

/**
 * Fetch the current execution status of a running orchestration.
 * Gateway RPC: orchestrations.status
 */
export async function getOrchestrationStatusRpc(
  client: GatewayClient,
  params: OrchestrationStatusParams,
): Promise<OrchestrationStatusResult> {
  return client.call<OrchestrationStatusResult>("orchestrations.status", params);
}

/**
 * Flat fan-out dispatch — send the same prompt to multiple agents simultaneously.
 * This is the Phase 1 simplified path before full graph orchestration.
 * Gateway RPC: sessions.dispatchParallel
 */
export async function dispatchParallelRpc(
  client: GatewayClient,
  params: ParallelDispatchParams,
): Promise<ParallelDispatchResult> {
  return client.call<ParallelDispatchResult>("sessions.dispatchParallel", params);
}
