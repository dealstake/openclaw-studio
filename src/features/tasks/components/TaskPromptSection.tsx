"use client";

import { memo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SectionLabel } from "@/components/SectionLabel";
import { textareaClass } from "@/features/tasks/lib/styles";

interface TaskPromptSectionProps {
  prompt: string;
  editing: boolean;
  editPrompt: string;
  /** Whether prompt section is initially expanded (e.g. when entering edit mode). */
  defaultExpanded?: boolean;
  onEditPromptChange: (value: string) => void;
}

export const TaskPromptSection = memo(function TaskPromptSection({
  prompt,
  editing,
  editPrompt,
  defaultExpanded = false,
  onEditPromptChange,
}: TaskPromptSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-border/40 px-4 py-3">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-left"
        onClick={() => setExpanded((p) => !p)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <SectionLabel as="span">Prompt</SectionLabel>
      </button>
      {editing ? (
        expanded ? (
          <textarea
            className={`${textareaClass} mt-2 min-h-[8rem]`}
            value={editPrompt}
            onChange={(e) => onEditPromptChange(e.target.value)}
            placeholder="Task prompt..."
            rows={6}
          />
        ) : null
      ) : (
        <pre
          className={`mt-2 overflow-y-auto rounded-md border border-border/60 bg-card/50 p-2 text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words ${
            expanded ? "max-h-40" : "max-h-[2.5rem] line-clamp-2"
          }`}
        >
          {prompt}
        </pre>
      )}
    </div>
  );
});
