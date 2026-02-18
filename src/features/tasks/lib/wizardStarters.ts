import type { TaskType } from "@/features/tasks/types";

export const WIZARD_STARTERS: Record<
  TaskType,
  Array<{ prompt: string; text: string }>
> = {
  constant: [
    {
      prompt: "Monitor my inbox for urgent emails",
      text: "Monitor my inbox",
    },
    {
      prompt: "Watch for new MCA applications",
      text: "Watch for new applications",
    },
    { prompt: "Track deal status changes", text: "Track deal changes" },
  ],
  periodic: [
    {
      prompt: "Summarize new emails every hour",
      text: "Summarize new emails",
    },
    {
      prompt: "Check for pending approvals",
      text: "Check pending approvals",
    },
    {
      prompt: "Update deal pipeline spreadsheet",
      text: "Update pipeline",
    },
  ],
  scheduled: [
    {
      prompt: "Send me a daily pipeline summary at 9am",
      text: "Daily pipeline summary",
    },
    {
      prompt: "Generate a weekly recap every Sunday",
      text: "Weekly recap",
    },
    {
      prompt: "Prepare a funding report on Mondays",
      text: "Monday funding report",
    },
  ],
};
