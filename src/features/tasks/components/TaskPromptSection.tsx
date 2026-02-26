"use client";

import { memo } from "react";
import { SectionLabel } from "@/components/SectionLabel";
import { textareaClass } from "@/features/tasks/lib/styles";

interface TaskPromptSectionProps {
  prompt: string;
  editing: boolean;
  editPrompt: string;
  /** @deprecated No longer used — prompt is always expanded */
  defaultExpanded?: boolean;
  onEditPromptChange: (value: string) => void;
}

export const TaskPromptSection = memo(function TaskPromptSection({
  prompt,
  editing,
  editPrompt,
  onEditPromptChange,
}: TaskPromptSectionProps) {
  return (
    <div className="border-b border-border/40 px-4 py-3">
      <SectionLabel as="span">Prompt</SectionLabel>
      {editing ? (
        <textarea
          className={`${textareaClass} mt-2 min-h-[8rem]`}
          value={editPrompt}
          onChange={(e) => onEditPromptChange(e.target.value)}
          placeholder="Task prompt..."
          rows={6}
        />
      ) : (
        <pre
          className="mt-2 overflow-y-auto rounded-md border border-border/60 bg-card/50 p-2 text-[10px] leading-relaxed text-muted-foreground whitespace-pre-wrap break-words max-h-40"
        >
          {prompt}
        </pre>
      )}
    </div>
  );
});
