"use client";

import { memo, type FC } from "react";
import { ThreadPrimitive } from "@assistant-ui/react";

interface WizardWelcomeProps {
  starters: Array<{ prompt: string; text: string }>;
}

export const WizardWelcome: FC<WizardWelcomeProps> = memo(
  function WizardWelcome({ starters }) {
    return (
      <div className="flex grow flex-col items-center justify-end px-2 pb-4">
        <div className="rounded-lg bg-muted/30 px-4 py-3 text-center text-sm text-foreground">
          <p>
            What do you want this task to do? Describe it in your own words
            — I&apos;ll help you set it up.
          </p>
        </div>
        <div className="mt-6 flex w-full flex-col gap-1.5">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Suggestions
          </span>
          {starters.map((s) => (
            <ThreadPrimitive.Suggestion
              key={s.prompt}
              prompt={s.prompt}
              autoSend
              className="rounded-md border border-border/60 bg-card/50 px-3 py-2.5 text-left text-xs text-muted-foreground transition hover:border-border hover:bg-muted/40 hover:text-foreground hover:bg-primary/10"
            >
              {s.text}
            </ThreadPrimitive.Suggestion>
          ))}
        </div>
      </div>
    );
  },
);
