"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { Copy } from "lucide-react";

import { SectionLabel, sectionLabelClass } from "@/components/SectionLabel";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

type IdentitySettingsSectionProps = {
  agentId: string;
  agentName: string;
  onRename: (value: string) => Promise<boolean>;
};

export const IdentitySettingsSection = memo(function IdentitySettingsSection({
  agentId,
  agentName,
  onRename,
}: IdentitySettingsSectionProps) {
  const [nameDraft, setNameDraft] = useState(agentName);
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const { isCopied: idCopied, copyToClipboard: copyAgentId } = useCopyToClipboard({ copiedDuration: 1500 });

  useEffect(() => {
    setNameDraft(agentName);
    setRenameError(null);
  }, [agentId, agentName]);

  const handleRename = useCallback(async () => {
    const next = nameDraft.trim();
    if (!next) {
      setRenameError("Agent name is required.");
      return;
    }
    if (next === agentName) {
      setRenameError(null);
      return;
    }
    setRenameSaving(true);
    setRenameError(null);
    try {
      const ok = await onRename(next);
      if (!ok) {
        setRenameError("Failed to rename agent.");
        return;
      }
      setNameDraft(next);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : "Failed to rename agent.");
    } finally {
      setRenameSaving(false);
    }
  }, [agentName, nameDraft, onRename]);

  const handleCopyId = useCallback(() => {
    copyAgentId(agentId);
  }, [agentId, copyAgentId]);

  return (
    <section
      className="rounded-md border border-border/80 bg-card/70 p-4"
      data-testid="agent-settings-identity"
    >
      <SectionLabel>Identity</SectionLabel>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-[11px] text-muted-foreground">
          ID: <span className="font-mono">{agentId}</span>
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground transition hover:bg-muted hover:text-foreground focus-ring"
              onClick={handleCopyId}
              aria-label="Copy agent ID"
            >
              <Copy className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {idCopied ? "Copied!" : "Copy agent ID"}
          </TooltipContent>
        </Tooltip>
      </div>

      <label
        htmlFor={`agent-name-${agentId}`}
        className={`mt-3 flex flex-col gap-2 ${sectionLabelClass} text-muted-foreground`}
      >
        <span>Agent name</span>
        <input
          id={`agent-name-${agentId}`}
          className="h-10 rounded-md border border-border bg-card/75 px-3 text-xs font-semibold text-foreground outline-none"
          value={nameDraft}
          disabled={renameSaving}
          onChange={(event) => setNameDraft(event.target.value)}
        />
      </label>
      {renameError ? (
        <div className="mt-3 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive-foreground">
          {renameError}
        </div>
      ) : null}
      <div className="mt-3 flex justify-end">
        <button
          className={`rounded-md border border-transparent bg-primary/90 px-4 py-2 ${sectionLabelClass} text-primary-foreground transition hover:bg-primary disabled:cursor-not-allowed disabled:border-border disabled:bg-muted disabled:text-muted-foreground focus-ring`}
          type="button"
          onClick={() => {
            void handleRename();
          }}
          disabled={renameSaving}
        >
          {renameSaving ? "Saving..." : "Update Name"}
        </button>
      </div>
    </section>
  );
});
