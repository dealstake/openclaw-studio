import {
  resolveConfiguredSshTarget,
  resolveGatewaySshTargetFromGatewayUrl,
} from "@/lib/ssh/gateway-host";
import { loadStudioSettings } from "@/lib/studio/settings-store";

const GATEWAY_BEADS_DIR_ENV = "OPENCLAW_TASK_CONTROL_PLANE_GATEWAY_BEADS_DIR";

export const resolveTaskControlPlaneSshTarget = (): string | null => {
  if (!process.env[GATEWAY_BEADS_DIR_ENV]) return null;

  const configured = resolveConfiguredSshTarget(process.env);
  if (configured) return configured;

  const settings = loadStudioSettings();
  return resolveGatewaySshTargetFromGatewayUrl(settings.gateway?.url ?? "", process.env);
};
