"use client";

import { memo } from "react";
import { Clock } from "lucide-react";
import type { TranscriptEntry } from "@/features/sessions/hooks/useTranscripts";
import {
  inferTranscriptType,
  formatTranscriptDisplayName,
  TRANSCRIPT_TYPE_LABELS,
  TRANSCRIPT_TYPE_COLORS,
} from "@/features/sessions/lib/transcriptUtils";
import { humanizeSessionKey } from "@/features/sessions/lib/sessionKeyUtils";
import { formatRelativeTime } from "@/lib/text/time";

import { sectionLabelClass } from "@/components/SectionLabel";
import { MarkdownViewer } from "@/components/MarkdownViewer";

export const TranscriptCard = memo(function TranscriptCard({
  transcript,
  onClick,
}: {
  transcript: TranscriptEntry;
  onClick?: () => void;
}) {
  const displayName = formatTranscriptDisplayName(transcript, humanizeSessionKey);
  const transcriptType = inferTranscriptType(transcript);

  return (
    <div
      role="button"
      tabIndex={0}
      className="group/transcript cursor-pointer rounded-md border border-border/80 bg-card/70 p-3 transition-all duration-200 hover:border-border hover:bg-muted/55"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <div className="flex items-center gap-1.5">
        <Clock className="h-3 w-3 flex-shrink-0 text-muted-foreground/60" />
        <span
          className={`truncate ${sectionLabelClass} text-foreground`}
          title={displayName}
        >
          {displayName}
        </span>
        <span className={`rounded border px-1 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] ${TRANSCRIPT_TYPE_COLORS[transcriptType]}`}>
          {TRANSCRIPT_TYPE_LABELS[transcriptType]}
        </span>
        {transcript.archived && (
          <span className="rounded border border-border/60 bg-muted/40 px-1 py-0.5 font-mono text-[8px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Archived
          </span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        {transcript.startedAt && (
          <span>{formatRelativeTime(new Date(transcript.startedAt).getTime())}</span>
        )}
        {transcript.model && (
          <span className="max-w-[120px] truncate">{transcript.model.split("/").pop()}</span>
        )}
        <span className="text-muted-foreground/60">{(transcript.size / 1024).toFixed(0)} KB</span>
      </div>
      {transcript.preview && (
        <MarkdownViewer content={transcript.preview} className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/80 [&>*]:m-0 [&>*>*]:m-0" />
      )}
    </div>
  );
});
