import type { WorkspaceGroup } from "../types";

export const GROUP_ORDER: WorkspaceGroup[] = ["projects", "memory", "brain", "other"];
export const GROUP_LABELS: Record<WorkspaceGroup, string> = {
  projects: "Projects",
  memory: "Memory",
  brain: "Brain Files",
  other: "Other",
};
