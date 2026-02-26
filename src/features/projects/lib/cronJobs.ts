import { toast } from "sonner";
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
  const action = enabled ? "resume" : "pause";
  const managed = tasks.filter((t) => t.autoManage);
  const results = await Promise.allSettled(
    managed.map((task) => updateCronJob(client, task.cronJobId, { enabled })),
  );
  const failures: string[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      const jobId = managed[i].cronJobId;
      console.error(`Failed to ${action} cron job ${jobId}:`, result.reason);
      failures.push(managed[i].name || jobId);
    }
  }
  if (failures.length > 0) {
    toast.error(`Failed to ${action} linked task${failures.length > 1 ? "s" : ""}`, {
      description: `Could not ${action}: ${failures.join(", ")}. Project status was updated but automated tasks may be out of sync.`,
    });
  }
}
