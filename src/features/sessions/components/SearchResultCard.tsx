"use client";

import { memo } from "react";
import { Search } from "lucide-react";
import type { TranscriptSearchResult } from "@/features/sessions/hooks/useTranscripts";
import { splitByQuery } from "@/features/sessions/lib/transcriptUtils";
import { humanizeSessionKey } from "@/features/sessions/lib/sessionKeyUtils";
import { formatRelativeTime } from "@/lib/text/time";

function HighlightedSnippet({ text, query }: { text: string; query: string }) {
  const segments = splitByQuery(text, query);
  return (
    <>
      {segments.map((seg, i) =>
        seg.match ? (
          <mark key={i} className="rounded-sm bg-yellow-400/30 px-0.5 text-foreground dark:bg-yellow-500/25">
            {seg.text}
          </mark>
        ) : (
          seg.text
        ),
      )}
    </>
  );
}

export const SearchResultCard = memo(function SearchResultCard({
  result,
  query,
  onClick,
}: {
  result: TranscriptSearchResult;
  query?: string;
  onClick?: () => void;
}) {
  const displayName = result.sessionKey
    ? humanizeSessionKey(result.sessionKey)
    : result.sessionId.slice(0, 12);

  return (
    <div
      role="button"
      tabIndex={0}
      className="group/result cursor-pointer rounded-md border border-border/80 bg-card/70 p-3 transition-all duration-200 hover:border-border hover:bg-muted/55"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="flex items-center gap-1.5">
        <Search className="h-3 w-3 flex-shrink-0 text-muted-foreground/60" />
        <span className="truncate font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
          {displayName}
        </span>
        {result.archived && (
          <span className="rounded border border-border/60 bg-muted/40 px-1 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Archived
          </span>
        )}
        <span className="ml-auto font-mono text-[9px] text-muted-foreground/60">
          {result.matches.length} match{result.matches.length !== 1 ? "es" : ""}
        </span>
      </div>
      {result.startedAt && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          {formatRelativeTime(new Date(result.startedAt).getTime())}
        </div>
      )}
      <div className="mt-1.5 flex flex-col gap-1">
        {result.matches.slice(0, 2).map((match, i) => (
          <div
            key={i}
            className="line-clamp-2 rounded bg-muted/30 px-2 py-1 text-[11px] leading-relaxed text-muted-foreground/80"
          >
            <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
              {match.role}:{" "}
            </span>
            <HighlightedSnippet text={match.snippet} query={query ?? ""} />
          </div>
        ))}
      </div>
    </div>
  );
});
