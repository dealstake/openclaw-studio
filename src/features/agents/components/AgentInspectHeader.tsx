"use client";
import { memo } from "react";
import { SectionLabel, sectionLabelClass} from "@/components/SectionLabel";

export const AgentInspectHeader = memo(function AgentInspectHeader({
  label,
  title,
  onClose,
  closeTestId,
  closeDisabled,
}: {
  label: string;
  title: string;
  onClose: () => void;
  closeTestId: string;
  closeDisabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between border-b border-border/80 px-4 py-3">
      <div>
        <SectionLabel>
          {label}
        </SectionLabel>
        <div className="console-title text-2xl leading-none text-foreground">{title}</div>
      </div>
      <button
        className={`rounded-md border border-border/80 bg-card/70 px-3 py-2 ${sectionLabelClass} text-muted-foreground transition hover:border-border hover:bg-muted/65`}
        type="button"
        data-testid={closeTestId}
        disabled={closeDisabled}
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
});
