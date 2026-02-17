import type { GatewayClient } from "@/lib/gateway/GatewayClient";
import { updateCronJob } from "@/lib/cron/types";
import type { ProjectDetails } from "./parseProject";

/**
 * Enable or disable auto-managed cron jobs associated with a project.
 * Called when a project is parked (disable) or activated (enable).
 */
export async function manageProjectCronJobs(
  client: GatewayClient,
  tasks: NonNullable<ProjectDetails["associatedTasks"]>,
  enabled: boolean,
): Promise<void> {
  const managed = tasks.filter((t) => t.autoManage);
  for (const task of managed) {
    try {
      await updateCronJob(client, task.cronJobId, { enabled });
    } catch (err) {
      console.warn(
        `Failed to ${enabled ? "resume" : "pause"} cron job ${task.cronJobId}:`,
        err,
      );
    }
  }
}
