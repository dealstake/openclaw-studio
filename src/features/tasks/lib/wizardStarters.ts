import type { TaskType } from "@/features/tasks/types";

export const WIZARD_STARTERS: Record<
  TaskType,
  Array<{ message: string; label: string }>
> = {
  constant: [
    {
      message: "Monitor my inbox for urgent emails",
      label: "Monitor my inbox",
    },
    {
      message: "Watch for new MCA applications",
      label: "Watch for new applications",
    },
    { message: "Track deal status changes", label: "Track deal changes" },
  ],
  periodic: [
    {
      message: "Summarize new emails every hour",
      label: "Summarize new emails",
    },
    {
      message: "Check for pending approvals",
      label: "Check pending approvals",
    },
    {
      message: "Update deal pipeline spreadsheet",
      label: "Update pipeline",
    },
  ],
  scheduled: [
    {
      message: "Send me a daily pipeline summary at 9am",
      label: "Daily pipeline summary",
    },
    {
      message: "Generate a weekly recap every Sunday",
      label: "Weekly recap",
    },
    {
      message: "Prepare a funding report on Mondays",
      label: "Monday funding report",
    },
  ],
};
