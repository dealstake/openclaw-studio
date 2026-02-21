import { memo } from "react";
import { Sparkles } from "lucide-react";

const CHAT_STARTERS = [
  { text: "📋 What's on my agenda?", prompt: "What's on my agenda today?" },
  { text: "🔨 Check project status", prompt: "Check the status of active projects" },
  { text: "📊 Review recent activity", prompt: "Review recent cron and agent activity" },
  { text: "🛠️ Help me build something", prompt: "Help me plan and build a new feature" },
];

export const ChatEmptyState = memo(function ChatEmptyState({
  agentName,
  onSend,
}: {
  agentName: string;
  onSend: (message: string) => void;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-4">
      <div className="flex flex-col items-center gap-2">
        <Sparkles className="h-7 w-7 text-brand-gold/60" />
        <h2 className="text-lg font-semibold text-foreground">
          What can {agentName} help with?
        </h2>
      </div>
      <div className="grid w-full max-w-md grid-cols-2 gap-2">
        {CHAT_STARTERS.map((s) => (
          <button
            key={s.text}
            type="button"
            onClick={() => onSend(s.prompt)}
            className="rounded-2xl border border-border/50 bg-transparent px-4 py-3.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground min-h-[44px]"
          >
            {s.text}
          </button>
        ))}
      </div>
    </div>
  );
});
