import { memo } from "react";
import { TridentLogo } from "@/components/brand/TridentLogo";

const CHAT_STARTERS = [
  {
    emoji: "📋",
    title: "What's on my agenda?",
    description: "Check today's tasks, meetings, and priorities",
    prompt: "What's on my agenda today?",
  },
  {
    emoji: "🔨",
    title: "Check project status",
    description: "Review active projects and recent progress",
    prompt: "Check the status of active projects",
  },
  {
    emoji: "📊",
    title: "Review recent activity",
    description: "See cron runs, sub-agent completions, and events",
    prompt: "Review recent cron and agent activity",
  },
  {
    emoji: "🛠️",
    title: "Help me build something",
    description: "Plan and implement a new feature or fix",
    prompt: "Help me plan and build a new feature",
  },
];

export const ChatEmptyState = memo(function ChatEmptyState({
  agentName,
  onSend,
}: {
  agentName: string;
  onSend: (message: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-10 px-4 pb-8 animate-in fade-in duration-500">
      {/* Hero section with subtle gradient background */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
          <TridentLogo size={36} className="text-primary" />
        </div>
        <div className="flex flex-col items-center gap-1.5">
          <h2 className="text-[length:var(--text-hero)] font-semibold leading-[var(--leading-hero)] text-foreground tracking-tight">
            What can {agentName} help with?
          </h2>
          <p className="text-[length:var(--text-body)] text-muted-foreground">
            Choose a suggestion or type your own message
          </p>
        </div>
      </div>

      {/* Suggestion cards */}
      <div className="grid w-full max-w-lg grid-cols-1 gap-3 sm:grid-cols-2">
        {CHAT_STARTERS.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={() => onSend(s.prompt)}
            className="group animate-in fade-in slide-in-from-bottom-2 duration-300 rounded-xl border border-border/60 bg-[color:var(--surface-3)] px-4 py-4 text-left transition-all hover:border-primary/30 hover:bg-[color:var(--surface-4)] hover:shadow-sm active:scale-[0.98] min-h-[44px]"
            style={{ animationDelay: `${i * 75}ms`, animationFillMode: "backwards" }}
          >
            <div className="flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5 transition-transform duration-200 group-hover:scale-110" aria-hidden="true">{s.emoji}</span>
              <div className="flex flex-col gap-1">
                <span className="text-[length:var(--text-body)] font-medium text-foreground">
                  {s.title}
                </span>
                <span className="text-[length:var(--text-caption)] text-muted-foreground leading-snug">
                  {s.description}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});
