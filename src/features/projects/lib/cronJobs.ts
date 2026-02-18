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
  const results = await Promise.allSettled(
    managed.map((task) => updateCronJob(client, task.cronJobId, { enabled })),
  );
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      console.error(
        `Failed to ${enabled ? "resume" : "pause"} cron job ${managed[i].cronJobId}:`,
        result.reason,
      );
    }
  }
}
