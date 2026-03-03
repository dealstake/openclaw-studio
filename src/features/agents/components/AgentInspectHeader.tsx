"use client";
import { memo } from "react";
import { X } from "lucide-react";
import { SectionLabel } from "@/components/SectionLabel";
import { IconButton } from "@/components/IconButton";

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
      <IconButton
        aria-label="Close panel"
        data-testid={closeTestId}
        disabled={closeDisabled}
        onClick={onClose}
      >
        <X className="h-3.5 w-3.5" />
      </IconButton>
    </div>
  );
});
