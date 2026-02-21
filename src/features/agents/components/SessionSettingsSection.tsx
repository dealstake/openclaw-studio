"use client";

import { memo, useCallback, useState } from "react";

import { SectionLabel, sectionLabelClass } from "@/components/SectionLabel";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SessionSettingsSectionProps = {
  toolCallingEnabled: boolean;
  showThinkingTraces: boolean;
  onToolCallingToggle: (enabled: boolean) => void;
  onThinkingTracesToggle: (enabled: boolean) => void;
  onNewSession: () => Promise<void> | void;
};

export const SessionSettingsSection = memo(function SessionSettingsSection({
  toolCallingEnabled,
  showThinkingTraces,
  onToolCallingToggle,
  onThinkingTracesToggle,
  onNewSession,
}: SessionSettingsSectionProps) {
  const [sessionBusy, setSessionBusy] = useState(false);

  const handleNewSession = useCallback(async () => {
    setSessionBusy(true);
    try {
      await onNewSession();
    } finally {
      setSessionBusy(false);
    }
  }, [onNewSession]);

  return (
    <>
      <section
        className="rounded-md border border-border/80 bg-card/70 p-4"
        data-testid="agent-settings-display"
      >
        <SectionLabel>Display</SectionLabel>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <label
            className={`flex items-center justify-between gap-3 rounded-md border border-border/80 bg-card/75 px-3 py-2 ${sectionLabelClass} text-muted-foreground`}
          >
            <span>Show tool calls</span>
            <input
              aria-label="Show tool calls"
              type="checkbox"
              className="h-4 w-4 rounded border-input text-foreground"
              checked={toolCallingEnabled}
              onChange={(event) => onToolCallingToggle(event.target.checked)}
            />
          </label>
          <label
            className={`flex items-center justify-between gap-3 rounded-md border border-border/80 bg-card/75 px-3 py-2 ${sectionLabelClass} text-muted-foreground`}
          >
            <span>Show thinking</span>
            <input
              aria-label="Show thinking"
              type="checkbox"
              className="h-4 w-4 rounded border-input text-foreground"
              checked={showThinkingTraces}
              onChange={(event) => onThinkingTracesToggle(event.target.checked)}
            />
          </label>
        </div>
      </section>

      <section
        className="rounded-md border border-border/80 bg-card/70 p-4"
        data-testid="agent-settings-session"
      >
        <SectionLabel>Session</SectionLabel>
        <div className="mt-3 text-[11px] text-muted-foreground">
          Start this agent in a fresh session and clear the visible transcript in Studio.
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="mt-3 block">
              <button
                className={`w-full rounded-md border border-border/80 bg-card/75 px-3 py-2 ${sectionLabelClass} text-foreground transition hover:border-border hover:bg-muted/70 disabled:cursor-not-allowed disabled:opacity-70 focus-ring`}
                type="button"
                onClick={() => {
                  void handleNewSession();
                }}
                disabled={sessionBusy}
              >
                {sessionBusy ? "Starting..." : "New session"}
              </button>
            </span>
          </TooltipTrigger>
          {sessionBusy && <TooltipContent>Session is starting…</TooltipContent>}
        </Tooltip>
      </section>
    </>
  );
});
