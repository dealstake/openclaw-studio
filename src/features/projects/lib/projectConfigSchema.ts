import { z } from "zod";
import type { ProjectConfig } from "../components/ProjectPreviewCard";

const ProjectPhaseSchema = z.object({
  name: z.string().min(1),
  tasks: z.array(z.string().min(1)),
});

export const ProjectConfigSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(["🔴 P0", "🟡 P1", "🟢 P2"]),
  type: z.string().min(1),
  phases: z.array(ProjectPhaseSchema),
}) satisfies z.ZodType<ProjectConfig>;
