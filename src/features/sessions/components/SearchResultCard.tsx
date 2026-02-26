"use client";

import { memo } from "react";
import { Search } from "lucide-react";
import type { TranscriptSearchResult } from "@/features/sessions/hooks/useTranscripts";
import { splitByQuery } from "@/features/sessions/lib/transcriptUtils";
import { humanizeSessionKey } from "@/features/sessions/lib/sessionKeyUtils";
import { formatRelativeTime } from "@/lib/text/time";
import { sectionLabelClass } from "@/components/SectionLabel";
import { BaseCard, CardHeader } from "@/components/ui/BaseCard";

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
    <BaseCard
      variant="compact"
      isHoverable
      className="cursor-pointer"
      role="option"
      aria-selected={false}
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <CardHeader>
        <Search className="h-3 w-3 flex-shrink-0 text-muted-foreground/60" />
        <span className={`truncate ${sectionLabelClass} text-foreground`}>
          {displayName}
        </span>
        {result.archived && (
          <span className="rounded border border-border/60 bg-muted/40 px-1 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Archived
          </span>
        )}
        <span className="ml-auto font-mono text-[10px] text-muted-foreground/60">
          {result.matches.length} match{result.matches.length !== 1 ? "es" : ""}
        </span>
      </CardHeader>
      {result.startedAt && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          {formatRelativeTime(new Date(result.startedAt).getTime())}
        </div>
      )}
      <div className="mt-1.5 flex flex-col gap-1">
        {result.matches.slice(0, 2).map((match, i) => (
          <div
            key={i}
            className="line-clamp-2 rounded bg-muted/30 px-2 py-1 text-xs leading-relaxed text-muted-foreground"
          >
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
              {match.role}:{" "}
            </span>
            <HighlightedSnippet text={match.snippet} query={query ?? ""} />
          </div>
        ))}
      </div>
    </BaseCard>
  );
});
